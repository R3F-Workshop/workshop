/** A stable random in [0, 1) from an index and a salt, so a tree keeps its shape across renders. */
export function hash(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
