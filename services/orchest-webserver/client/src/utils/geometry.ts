/** A 2-dimensional point: X, Y. */
export type Point2D = [number, number];

/** Adds the X and Y components of the second point to the first point. */
export const addPoints = (
  [x, y]: Readonly<Point2D>,
  [ax, ay]: Readonly<Point2D>
): Point2D => [x + ax, y + ay];

/** Subtracts the X and Y components of the second point from the first point. */
export const subtractPoints = (
  [x, y]: Readonly<Point2D>,
  [sx, sy]: Readonly<Point2D>
): Point2D => [x - sx, y - sy];

/** Divides the X and Y components of the point with a scalar value. */
export const dividePoint = (
  [x, y]: Readonly<Point2D>,
  divisor: number
): Point2D => [x / divisor, y / divisor];

/** Multiplies the X and Y components of the point with a scalar value. */
export const multiplyPoint = (
  [x, y]: Readonly<Point2D>,
  factor: number
): Point2D => [x * factor, y * factor];

/** Joins the X and Y component of the point with (", ") and appends desired units. */
export const stringifyPoint = ([x, y]: Readonly<Point2D>, units = ""): string =>
  `${x}${units}, ${y}${units}`;

/** Returns true if the X and Y components are the same in both points. */
export const isSamePoint = (
  [x1, y1]: Readonly<Point2D>,
  [x2, y2]: Readonly<Point2D>
) => x1 === x2 && y1 === y2;

export type Rect = {
  origin: Point2D;
  width: number;
  height: number;
};

/** Creates a rect from a starting and ending point. */
export const createRect = (
  [startX, startY]: Point2D,
  [endX, endY]: Point2D
): Rect => ({
  origin: [Math.min(startX, endX), Math.min(startY, endY)],
  width: Math.abs(endX - startX),
  height: Math.abs(endY - startY),
});

/** Returns true if the rects intersect each other. */
export const rectsIntersect = (r1: Rect, r2: Rect) =>
  !(
    r2.origin[0] > r1.origin[0] + r1.width ||
    r2.origin[0] + r2.width < r1.origin[0] ||
    r2.origin[1] > r1.origin[1] + r1.height ||
    r2.origin[1] + r2.height < r1.origin[1]
  );

/**
 * Returns the center point of a list of points.
 * Note: Returns `[NaN, NaN]` if no points are provided.
 */
export const centroid = (points: readonly Readonly<Point2D>[]): Point2D => {
  let cx = 0;
  let cy = 0;

  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }

  return [cx / points.length, cy / points.length];
};
