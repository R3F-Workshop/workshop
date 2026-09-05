import { abs, acos, bool, Break, ceil, clamp, Continue, cos, countOneBits, cross, div, dot, float, Fn, fract, getNormalFromDepth, getViewPosition, HALF_PI, If, interleavedGradientNoise, logarithmicDepthToViewZ, Loop, max, mix, mul, NodeUpdateType, normalize, passTexture, PI, pow, rand, reference, screenCoordinate, shiftRight, sign, sin, sqrt, sub, uint, uniform, uv, vec2, vec3, vec4, viewZToPerspectiveDepth } from 'three/tsl';
import { MathUtils, NodeMaterial, QuadMesh, RedFormat, RendererUtils, RenderTarget, TempNode, UnsignedByteType, Vector2 } from 'three/webgpu';

const _quadMesh = /* @__PURE__ */ new QuadMesh();
const _size = /* @__PURE__ */ new Vector2();

// From Activision GTAO paper: https://www.activision.com/cdn/research/s2016_pbs_activision_occlusion.pptx
const _temporalRotations = [ 60, 300, 180, 240, 120, 0 ];
const _spatialOffsets = [ 0, 0.5, 0.25, 0.75 ];

let _rendererState;

/** Post processing node for applying Screen Space Ambient Occlusion (SSAO) to a scene. */
class SSAONode extends TempNode {

	static get type() {

		return 'SSAONode';

	}

	/** Constructs a new SSAO node. */
	constructor( depthNode, normalNode, camera, alphaNode = null ) {

		super( 'vec4' );

		/** A node that represents the scene's depth. */
		this.depthNode = depthNode;

		/** An optional node whose alpha channel represents the scene's surface opacity. */
		this.alphaNode = alphaNode;

		/** A node that represents the scene's normals. */
		this.normalNode = normalNode;

		/** The `updateBeforeType` is set to `NodeUpdateType.FRAME` since the node renders its effect once per frame in `updateBefore()`. */
		this.updateBeforeType = NodeUpdateType.FRAME;

		/** Number of per-pixel hemisphere slices. */
		this.sliceCount = uniform( 1, 'uint' );

		/** Number of samples taken along one side of a given hemisphere slice. */
		this.stepCount = uniform( 12, 'uint' );

		/** Power function applied to AO to make it appear darker/lighter. */
		this.aoIntensity = uniform( 1, 'float' );

		/** Surfaces whose alpha (sampled from {@link SSAONode#alphaNode}) is below this value are treated as fully transparent and excluded from occlusion. */
		this.alphaThreshold = uniform( 1, 'float' );

		/** Effective sampling radius in world space. */
		this.radius = uniform( 12, 'float' );

		/** Makes the sample distance in screen space instead of world-space (helps having more detail up close). */
		this.useScreenSpaceSampling = uniform( true, 'bool' );

		/** Controls samples distribution. */
		this.expFactor = uniform( 2, 'float' );

		/** Constant thickness value of objects on the screen in world units. */
		this.thickness = uniform( 1, 'float' );

		/** Whether to increase thickness linearly over distance or not (avoid losing detail over the distance). */
		this.useLinearThickness = uniform( false, 'bool' );

		/** Whether to use temporal filtering or not. */
		this.useTemporalFiltering = true;

		// private uniforms

		/** The resolution of the effect. */
		this._resolution = uniform( new Vector2() );


		this._halfProjScale = uniform( 1 );

		/** Temporal direction that influences the rotation angle for each slice. */
		this._temporalDirection = uniform( 0 );

		/** Temporal offset added to the initial ray step. */
		this._temporalOffset = uniform( 0 );

		/** Represents the inverse projection matrix of the scene's camera. */
		this._cameraProjectionMatrixInverse = uniform( camera.projectionMatrixInverse );

		/** Represents the near value of the scene's camera. */
		this._cameraNear = reference( 'near', 'float', camera );

		/** Represents the far value of the scene's camera. */
		this._cameraFar = reference( 'far', 'float', camera );

		/** A reference to the scene's camera. */
		this._camera = camera;

		/** The render target the effect is rendered into. */
		this._renderTarget = new RenderTarget( 1, 1, { depthBuffer: false } );

		const aoTexture = this._renderTarget.texture;
		aoTexture.name = 'SSAO.AO';
		aoTexture.type = UnsignedByteType;
		aoTexture.format = RedFormat;

		/** The material that is used to render the effect. */
		this._material = new NodeMaterial();
		this._material.name = 'SSAO';

		/** The AO result of the effect is represented as a separate texture node. */
		this._aoNode = passTexture( this, this._renderTarget.texture );

	}

	/** Returns the AO result of the effect as a texture node. */
	getAONode() {

		return this._aoNode;

	}

	/** Sets the size of the effect. */
	setSize( width, height ) {

		this._resolution.value.set( width, height );
		this._renderTarget.setSize( width, height );

		this._halfProjScale.value = height / ( Math.tan( this._camera.fov * MathUtils.DEG2RAD * 0.5 ) * 2 ) * 0.5;

	}


	updateBefore( frame ) {

		const { renderer } = frame;

		_rendererState = RendererUtils.resetRendererState( renderer, _rendererState );



		const size = renderer.getDrawingBufferSize( _size );
		this.setSize( size.width, size.height );

		// update temporal uniforms

		if ( this.useTemporalFiltering === true ) {

			const frameId = frame.frameId;

			this._temporalDirection.value = _temporalRotations[ frameId % 6 ] / 360;
			this._temporalOffset.value = _spatialOffsets[ frameId % 4 ];

		} else {

			this._temporalDirection.value = 1;
			this._temporalOffset.value = 1;

		}



		_quadMesh.material = this._material;
		_quadMesh.name = 'SSAO';

		// clear (white for the AO attachment)

		renderer.setClearColor( 0xffffff, 1 );

		// ao

		renderer.setRenderTarget( this._renderTarget );
		_quadMesh.render( renderer );

		// restore

		RendererUtils.restoreRendererState( renderer, _rendererState );

	}


	setup( builder ) {

		const uvNode = uv();
		const MAX_RAY = uint( 32 );
		const globalOccludedBitfield = uint( 0 );

		const sampleDepth = ( uv ) => {

			const depth = this.depthNode.sample( uv ).r;

			if ( builder.renderer.logarithmicDepthBuffer === true ) {

				const viewZ = logarithmicDepthToViewZ( depth, this._cameraNear, this._cameraFar );

				return viewZToPerspectiveDepth( viewZ, this._cameraNear, this._cameraFar );

			}

			return depth;

		};

		const sampleNormal = ( uv ) => ( this.normalNode !== null ) ? this.normalNode.sample( uv ).rgb.normalize() : getNormalFromDepth( uv, this.depthNode.value, this._cameraProjectionMatrixInverse );

		// Surface opacity at a given uv.
		const sampleAlpha = ( uv ) => ( this.alphaNode !== null ) ? this.alphaNode.sample( uv ).a : float( 1 );

		// From Activision GTAO paper: https://www.activision.com/cdn/research/s2016_pbs_activision_occlusion.pptx

		const spatialOffsets = Fn( ( [ position ] ) => {

			return float( 0.25 ).mul( sub( position.y, position.x ).bitAnd( 3 ) );

		} ).setLayout( {
			name: 'spatialOffsets',
			type: 'float',
			inputs: [
				{ name: 'position', type: 'vec2' }
			]
		} );

		const GTAOFastAcos = Fn( ( [ value ] ) => {

			const outVal = abs( value ).mul( float( - 0.156583 ) ).add( HALF_PI );
			outVal.mulAssign( sqrt( abs( value ).oneMinus() ) );

			const x = value.x.greaterThanEqual( 0 ).select( outVal.x, PI.sub( outVal.x ) );
			const y = value.y.greaterThanEqual( 0 ).select( outVal.y, PI.sub( outVal.y ) );

			return vec2( x, y );

		} ).setLayout( {
			name: 'GTAOFastAcos',
			type: 'vec2',
			inputs: [
				{ name: 'value', type: 'vec2' }
			]
		} );

		const horizonSampling = Fn( ( [ directionIsRight, stepRadius, radiusVS, viewPosition, slideDirTexelSize, initialRayStep, uvNode, viewDir, n ] ) => {

			const STEP_COUNT = this.stepCount.toConst();
			const EXP_FACTOR = this.expFactor.toConst();
			const THICKNESS = this.thickness.toConst();

			const uvDirection = directionIsRight.select( vec2( 1, - 1 ), vec2( - 1, 1 ) ); // Port note: Because of different uv conventions, uv-y has a different sign
			const samplingDirection = directionIsRight.select( 1, - 1 );

			Loop( { start: uint( 0 ), end: STEP_COUNT, type: 'uint', condition: '<' }, ( { i } ) => {

				const offset = pow( abs( mul( stepRadius, float( i ).add( initialRayStep ) ).div( radiusVS ) ), EXP_FACTOR ).mul( radiusVS ).toConst();
				const uvOffset = slideDirTexelSize.mul( max( offset, float( i ).add( 1 ) ) ).toConst();
				const sampleUV = uvNode.add( uvOffset.mul( uvDirection ) ).toConst();

				If( sampleUV.x.lessThanEqual( 0 ).or( sampleUV.y.lessThanEqual( 0 ) ).or( sampleUV.x.greaterThanEqual( 1 ) ).or( sampleUV.y.greaterThanEqual( 1 ) ), () => {

					Break();

				} );

				// Skip occlusion from transparent/faded surfaces.
				If( sampleAlpha( sampleUV ).lessThan( this.alphaThreshold ), () => {

					Continue();

				} );

				const sampleViewPosition = getViewPosition( sampleUV, sampleDepth( sampleUV ), this._cameraProjectionMatrixInverse ).toConst();
				const pixelToSample = sampleViewPosition.sub( viewPosition ).normalize().toConst();
				const linearThicknessMultiplier = this.useLinearThickness.select( sampleViewPosition.z.negate().div( this._cameraFar ).clamp().mul( 100 ), float( 1 ) );
				const pixelToSampleBackface = normalize( sampleViewPosition.sub( linearThicknessMultiplier.mul( viewDir ).mul( THICKNESS ) ).sub( viewPosition ) );

				let frontBackHorizon = vec2( dot( pixelToSample, viewDir ), dot( pixelToSampleBackface, viewDir ) );
				frontBackHorizon = GTAOFastAcos( clamp( frontBackHorizon, - 1, 1 ) );
				frontBackHorizon = clamp( div( mul( samplingDirection, frontBackHorizon.negate() ).sub( n.sub( HALF_PI ) ), PI ) ); // Port note: subtract half pi instead of adding it
				frontBackHorizon = directionIsRight.select( frontBackHorizon.yx, frontBackHorizon.xy ); // Front/Back get inverted depending on angle

				// inline ComputeOccludedBitfield() for easier debugging

				const minHorizon = frontBackHorizon.x.toConst();
				const maxHorizon = frontBackHorizon.y.toConst();

				const startHorizonInt = uint( frontBackHorizon.mul( float( MAX_RAY ) ) ).toConst();
				const angleHorizonInt = uint( ceil( maxHorizon.sub( minHorizon ).mul( float( MAX_RAY ) ) ) ).toConst();
				const angleHorizonBitfield = angleHorizonInt.greaterThan( uint( 0 ) ).select( uint( shiftRight( uint( 0xFFFFFFFF ), uint( 32 ).sub( MAX_RAY ).add( MAX_RAY.sub( angleHorizonInt ) ) ) ), uint( 0 ) ).toConst();
				let currentOccludedBitfield = angleHorizonBitfield.shiftLeft( startHorizonInt );
				currentOccludedBitfield = currentOccludedBitfield.bitAnd( globalOccludedBitfield.bitNot() );

				globalOccludedBitfield.assign( globalOccludedBitfield.bitOr( currentOccludedBitfield ) );

			} );

			return globalOccludedBitfield;

		} );

		const ao = Fn( () => {

			const depth = sampleDepth( uvNode ).toVar();

			depth.greaterThanEqual( 1.0 ).discard();

			// Surface opacity of the shaded pixel.
			const surfaceAlpha = sampleAlpha( uvNode ).toVar();

			const viewPosition = getViewPosition( uvNode, depth, this._cameraProjectionMatrixInverse ).toVar();
			const viewNormal = sampleNormal( uvNode ).toVar();
			const viewDir = normalize( viewPosition.xyz.negate() ).toVar();



			const noiseOffset = spatialOffsets( screenCoordinate );
			const noiseDirection = interleavedGradientNoise( screenCoordinate );
			const noiseJitterIdx = this._temporalDirection.mul( 0.02 ); // Port: Add noiseJitterIdx here for slightly better noise convergence with TRAA (see #31890 for more details)
			const initialRayStep = fract( noiseOffset.add( this._temporalOffset ) ).add( rand( uvNode.add( noiseJitterIdx ).mul( 2 ).sub( 1 ) ) );

			const aoValue = float( 0 ).toVar();

			const ROTATION_COUNT = this.sliceCount.toConst();
			const STEP_COUNT = this.stepCount.toConst();
			const AO_INTENSITY = this.aoIntensity.toConst();
			const RADIUS = this.radius.toConst();

			const stepRadius = float( 0 ).toVar();

			If( this.useScreenSpaceSampling, () => {

				stepRadius.assign( RADIUS.mul( this._resolution.x.div( 2 ) ).div( float( 16 ) ) ); // SSRT3 has a bug where stepRadius is divided by STEP_COUNT twice: fix here

			} ).Else( () => {

				stepRadius.assign( max( RADIUS.mul( this._halfProjScale ).div( viewPosition.z.negate() ), float( STEP_COUNT ) ) ); // Port note: viewZ is negative so a negate is required

			} );

			stepRadius.divAssign( float( STEP_COUNT ).add( 1 ) );
			const radiusVS = max( 1, float( STEP_COUNT.sub( 1 ) ) ).mul( stepRadius ).toConst();



			Loop( { start: uint( 0 ), end: ROTATION_COUNT, type: 'uint', condition: '<' }, ( { i } ) => {

				const rotationAngle = mul( float( i ).add( noiseDirection ).add( this._temporalDirection ), PI.div( float( ROTATION_COUNT ) ) ).toConst();
				const sliceDir = vec3( vec2( cos( rotationAngle ), sin( rotationAngle ) ), 0 ).toConst();
				const slideDirTexelSize = sliceDir.xy.mul( float( 1 ).div( this._resolution ) ).toConst();

				const planeNormal = normalize( cross( sliceDir, viewDir ) ).toConst();
				const tangent = cross( viewDir, planeNormal ).toConst();
				const projectedNormal = viewNormal.sub( planeNormal.mul( dot( viewNormal, planeNormal ) ) ).toConst();
				const projectedNormalNormalized = normalize( projectedNormal ).toConst();

				const cos_n = clamp( dot( projectedNormalNormalized, viewDir ), - 1, 1 ).toConst();
				const n = sign( dot( projectedNormal, tangent ) ).negate().mul( acos( cos_n ) ).toConst();

				globalOccludedBitfield.assign( 0 );

				globalOccludedBitfield.assign( horizonSampling( bool( true ), stepRadius, radiusVS, viewPosition, slideDirTexelSize, initialRayStep, uvNode, viewDir, n ) );
				globalOccludedBitfield.assign( horizonSampling( bool( false ), stepRadius, radiusVS, viewPosition, slideDirTexelSize, initialRayStep, uvNode, viewDir, n ) );

				aoValue.addAssign( float( countOneBits( globalOccludedBitfield ) ).div( float( MAX_RAY ) ) );

			} );

			aoValue.divAssign( float( ROTATION_COUNT ) );
			aoValue.assign( pow( aoValue.clamp().oneMinus(), AO_INTENSITY ).clamp() );

			// Fade AO toward 1 (no occlusion) as the surface becomes transparent, so faded areas lose AO gradually instead of forming a hard outline.
			aoValue.assign( mix( float( 1 ), aoValue, surfaceAlpha.clamp() ) );

			return vec4( aoValue, aoValue, aoValue, 1 );

		} );

		this._material.colorNode = ao().context( builder.getSharedContext() );
		this._material.needsUpdate = true;



		return this._aoNode;

	}

	/** Frees internal resources. */
	dispose() {

		this._renderTarget.dispose();

		this._material.dispose();

	}

}

export default SSAONode;

/**
 * TSL function for creating a SSAO effect.
 * @param {import('three/webgpu').Node | null} [alphaNode]
 */
export const ssao = ( depthNode, normalNode, camera, alphaNode = null ) => new SSAONode( depthNode, normalNode, camera, alphaNode );
