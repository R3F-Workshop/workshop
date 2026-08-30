import { abs, acos, bool, Break, ceil, clamp, Continue, cos, countOneBits, cross, div, dot, float, Fn, fract, getNormalFromDepth, getViewPosition, HALF_PI, If, interleavedGradientNoise, logarithmicDepthToViewZ, Loop, max, mix, mul, NodeUpdateType, normalize, passTexture, PI, pow, rand, reference, screenCoordinate, shiftRight, sign, sin, sqrt, sub, uint, uniform, uv, vec2, vec3, vec4, viewZToPerspectiveDepth } from 'three/tsl';
import { MathUtils, NodeMaterial, QuadMesh, RedFormat, RendererUtils, RenderTarget, TempNode, UnsignedByteType, Vector2 } from 'three/webgpu';

const _quadMesh = /*@__PURE__*/ new QuadMesh();
const _size = /*@__PURE__*/ new Vector2();

// From Activision GTAO paper: https://www.activision.com/cdn/research/s2016_pbs_activision_occlusion.pptx
const _temporalRotations = [ 60, 300, 180, 240, 120, 0 ];
const _spatialOffsets = [ 0, 0.5, 0.25, 0.75 ];

let _rendererState;

/**
 * Post processing node for applying Screen Space Ambient Occlusion (SSAO) to a scene.
 *
 * This is an AO-only port of the SSGI effect: it keeps only the bitmask horizon based
 * ambient occlusion calculation and drops all the indirect diffuse (GI) work.
 *
 * References:
 * - {@link https://github.com/cdrinmatane/SSRT3}.
 * - {@link https://cdrinmatane.github.io/posts/ssaovb-code/}.
 * - {@link https://cdrinmatane.github.io/cgspotlight-slides/ssilvb_slides.pdf}.
 *
 * The quality and performance of the effect mainly depend on `sliceCount` and `stepCount`.
 * The total number of samples taken per pixel is `sliceCount` * `stepCount` * `2`. Here are some
 * recommended presets depending on whether temporal filtering is used or not.
 *
 * With temporal filtering (recommended):
 *
 * - Low: `sliceCount` of `1`, `stepCount` of `12`.
 * - Medium: `sliceCount` of `2`, `stepCount` of `8`.
 * - High: `sliceCount` of `3`, `stepCount` of `16`.
 *
 * Without temporal filtering:
 *
 * - Low: `sliceCount` of `2`, `stepCount` of `6`.
 * - Medium: `sliceCount` of `3`, `stepCount` of `8`.
 * - High: `sliceCount` of `4`, `stepCount` of `12`.
 *
 * @augments TempNode
 */
class SSAONode extends TempNode {

	static get type() {

		return 'SSAONode';

	}

	/**
	 * Constructs a new SSAO node.
	 *
	 * @param {TextureNode} depthNode - A texture node that represents the scene's depth.
	 * @param {TextureNode} normalNode - A texture node that represents the scene's normals.
	 * @param {PerspectiveCamera} camera - The camera the scene is rendered with.
	 * @param {?TextureNode} [alphaNode=null] - An optional texture node whose alpha channel represents the scene's surface opacity. When provided, samples whose surface alpha is below `alphaThreshold` are excluded from occlusion so transparent/faded meshes do not cast AO.
	 */
	constructor( depthNode, normalNode, camera, alphaNode = null ) {

		super( 'vec4' );

		/**
		 * A node that represents the scene's depth.
		 *
		 * @type {TextureNode}
		 */
		this.depthNode = depthNode;

		/**
		 * An optional node whose alpha channel represents the scene's surface
		 * opacity. When set, occlusion samples on surfaces whose alpha is below
		 * {@link SSAONode#alphaThreshold} are ignored, so transparent or faded
		 * meshes do not contribute ambient occlusion.
		 *
		 * @type {?TextureNode}
		 * @default null
		 */
		this.alphaNode = alphaNode;

		/**
		 * A node that represents the scene's normals. If no normals are passed to the
		 * constructor (because MRT is not available), normals can be automatically
		 * reconstructed from depth values in the shader.
		 *
		 * @type {TextureNode}
		 */
		this.normalNode = normalNode;

		/**
		 * The `updateBeforeType` is set to `NodeUpdateType.FRAME` since the node renders
		 * its effect once per frame in `updateBefore()`.
		 *
		 * @type {string}
		 * @default 'frame'
		 */
		this.updateBeforeType = NodeUpdateType.FRAME;

		/**
		 * Number of per-pixel hemisphere slices. This has a big performance cost and should be kept as low as possible.
		 * Should be in the range `[1, 4]`.
		 *
		 * @type {UniformNode<uint>}
		 * @default 1
		 */
		this.sliceCount = uniform( 1, 'uint' );

		/**
		 * Number of samples taken along one side of a given hemisphere slice. This has a big performance cost and should
		 * be kept as low as possible.  Should be in the range `[1, 32]`.
		 *
		 * @type {UniformNode<uint>}
		 * @default 12
		 */
		this.stepCount = uniform( 12, 'uint' );

		/**
		 * Power function applied to AO to make it appear darker/lighter. Should be in the range `[0, 4]`.
		 *
		 * @type {UniformNode<float>}
		 * @default 1
		 */
		this.aoIntensity = uniform( 1, 'float' );

		/**
		 * Surfaces whose alpha (sampled from {@link SSAONode#alphaNode}) is below
		 * this value are treated as fully transparent and excluded from occlusion.
		 * Only used when `alphaNode` is provided. Should be in the range `[0, 1]`.
		 *
		 * @type {UniformNode<float>}
		 * @default 0.5
		 */
		this.alphaThreshold = uniform( 1, 'float' );

		/**
		 * Effective sampling radius in world space. AO can only have influence within that radius.
		 * Should be in the range `[1, 25]`.
		 *
		 * @type {UniformNode<float>}
		 * @default 12
		 */
		this.radius = uniform( 12, 'float' );

		/**
		 * Makes the sample distance in screen space instead of world-space (helps having more detail up close).
		 *
		 * @type {UniformNode<bool>}
		 * @default true
		 */
		this.useScreenSpaceSampling = uniform( true, 'bool' );

		/**
		 * Controls samples distribution. It's an exponent applied at each step get increasing step size over the distance.
		 * Should be in the range `[1, 3]`.
		 *
		 * @type {UniformNode<float>}
		 * @default 2
		 */
		this.expFactor = uniform( 2, 'float' );

		/**
		 * Constant thickness value of objects on the screen in world units. Allows occlusion to pass behind surfaces past that thickness value.
		 * Should be in the range `[0.01, 10]`.
		 *
		 * @type {UniformNode<float>}
		 * @default 1
		 */
		this.thickness = uniform( 1, 'float' );

		/**
		 * Whether to increase thickness linearly over distance or not (avoid losing detail over the distance).
		 *
		 * @type {UniformNode<bool>}
		 * @default false
		 */
		this.useLinearThickness = uniform( false, 'bool' );

		/**
		 * Whether to use temporal filtering or not. Setting this property to
		 * `true` requires the usage of `TRAANode`. This will help to reduce noise
		 * although it introduces typical TAA artifacts like ghosting and temporal
		 * instabilities.
		 *
		 * If setting this property to `false`, a manual denoise via `DenoiseNode`
		 * is required.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.useTemporalFiltering = true;

		// private uniforms

		/**
		 * The resolution of the effect.
		 *
		 * @private
		 * @type {UniformNode<vec2>}
		 */
		this._resolution = uniform( new Vector2() );

		/**
		 * Used to compute the effective step radius when viewSpaceSampling is `false`.
		 *
		 * @private
		 * @type {UniformNode<vec2>}
		 */
		this._halfProjScale = uniform( 1 );

		/**
		 * Temporal direction that influences the rotation angle for each slice.
		 *
		 * @private
		 * @type {UniformNode<float>}
		 */
		this._temporalDirection = uniform( 0 );

		/**
		 * Temporal offset added to the initial ray step.
		 *
		 * @private
		 * @type {UniformNode<float>}
		 */
		this._temporalOffset = uniform( 0 );

		/**
		 * Represents the inverse projection matrix of the scene's camera.
		 *
		 * @private
		 * @type {UniformNode<mat4>}
		 */
		this._cameraProjectionMatrixInverse = uniform( camera.projectionMatrixInverse );

		/**
		 * Represents the near value of the scene's camera.
		 *
		 * @private
		 * @type {ReferenceNode<float>}
		 */
		this._cameraNear = reference( 'near', 'float', camera );

		/**
		 * Represents the far value of the scene's camera.
		 *
		 * @private
		 * @type {ReferenceNode<float>}
		 */
		this._cameraFar = reference( 'far', 'float', camera );

		/**
		 * A reference to the scene's camera.
		 *
		 * @private
		 * @type {PerspectiveCamera}
		 */
		this._camera = camera;

		/**
		 * The render target the effect is rendered into. The single texture holds the AO.
		 *
		 * @private
		 * @type {RenderTarget}
		 */
		this._renderTarget = new RenderTarget( 1, 1, { depthBuffer: false } );

		const aoTexture = this._renderTarget.texture;
		aoTexture.name = 'SSAO.AO';
		aoTexture.type = UnsignedByteType;
		aoTexture.format = RedFormat;

		/**
		 * The material that is used to render the effect.
		 *
		 * @private
		 * @type {NodeMaterial}
		 */
		this._material = new NodeMaterial();
		this._material.name = 'SSAO';

		/**
		 * The AO result of the effect is represented as a separate texture node.
		 *
		 * @private
		 * @type {PassTextureNode}
		 */
		this._aoNode = passTexture( this, this._renderTarget.texture );

	}

	/**
	 * Returns the AO result of the effect as a texture node.
	 *
	 * @return {PassTextureNode} A texture node that represents the AO result of the effect.
	 */
	getAONode() {

		return this._aoNode;

	}

	/**
	 * Sets the size of the effect.
	 *
	 * @param {number} width - The width of the effect.
	 * @param {number} height - The height of the effect.
	 */
	setSize( width, height ) {

		this._resolution.value.set( width, height );
		this._renderTarget.setSize( width, height );

		this._halfProjScale.value = height / ( Math.tan( this._camera.fov * MathUtils.DEG2RAD * 0.5 ) * 2 ) * 0.5;

	}

	/**
	 * This method is used to render the effect once per frame.
	 *
	 * @param {NodeFrame} frame - The current node frame.
	 */
	updateBefore( frame ) {

		const { renderer } = frame;

		_rendererState = RendererUtils.resetRendererState( renderer, _rendererState );

		//

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

		//

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

	/**
	 * This method is used to setup the effect's TSL code.
	 *
	 * @param {NodeBuilder} builder - The current node builder.
	 * @return {PassTextureNode}
	 */
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

		// Surface opacity at a given uv. Defaults to fully opaque when no alpha
		// source is provided, so behaviour is unchanged unless `alphaNode` is set.
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

				// Skip occlusion from transparent/faded surfaces. Their alpha is below
				// the threshold, so treat them as empty space and keep marching.
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

			// Surface opacity of the shaded pixel. Used to smoothly fade AO out on
			// transparent/faded surfaces so no hard ring appears at the fade edge.
			const surfaceAlpha = sampleAlpha( uvNode ).toVar();

			const viewPosition = getViewPosition( uvNode, depth, this._cameraProjectionMatrixInverse ).toVar();
			const viewNormal = sampleNormal( uvNode ).toVar();
			const viewDir = normalize( viewPosition.xyz.negate() ).toVar();

			//

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

				stepRadius.assign( RADIUS.mul( this._resolution.x.div( 2 ) ).div( float( 16 ) ) ); // SSRT3 has a bug where stepRadius is divided by STEP_COUNT twice; fix here

			} ).Else( () => {

				stepRadius.assign( max( RADIUS.mul( this._halfProjScale ).div( viewPosition.z.negate() ), float( STEP_COUNT ) ) ); // Port note: viewZ is negative so a negate is required

			} );

			stepRadius.divAssign( float( STEP_COUNT ).add( 1 ) );
			const radiusVS = max( 1, float( STEP_COUNT.sub( 1 ) ) ).mul( stepRadius ).toConst();

			//

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

			// Fade AO toward 1 (no occlusion) as the surface becomes transparent, so
			// faded areas lose AO gradually instead of forming a hard outline.
			aoValue.assign( mix( float( 1 ), aoValue, surfaceAlpha.clamp() ) );

			return vec4( aoValue, aoValue, aoValue, 1 );

		} );

		this._material.colorNode = ao().context( builder.getSharedContext() );
		this._material.needsUpdate = true;

		//

		return this._aoNode;

	}

	/**
	 * Frees internal resources. This method should be called
	 * when the effect is no longer required.
	 */
	dispose() {

		this._renderTarget.dispose();

		this._material.dispose();

	}

}

export default SSAONode;

/**
 * TSL function for creating a SSAO effect.
 *
 * @tsl
 * @function
 * @param {TextureNode} depthNode - A texture node that represents the scene's depth.
 * @param {TextureNode} normalNode - A texture node that represents the scene's normals.
 * @param {Camera} camera - The camera the scene is rendered with.
 * @param {?TextureNode} [alphaNode=null] - An optional texture node whose alpha channel represents the scene's surface opacity.
 * @returns {SSAONode}
 */
export const ssao = ( depthNode, normalNode, camera, alphaNode = null ) => new SSAONode( depthNode, normalNode, camera, alphaNode );
