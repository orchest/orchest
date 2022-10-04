import { Point2D } from "./geometry";

const point: Point2D = [0, 0];
const delta: Point2D = [0, 0];

const onMouseMove = ({ clientX, clientY }: MouseEvent) => {
  const [previousX, previousY] = point;

  delta[0] = clientX - previousX;
  delta[1] = clientY - previousY;
  point[0] = clientX;
  point[1] = clientY;
};

document.body.addEventListener("mousemove", onMouseMove);

/** Returns the current position of the mouse pointer. */
export const getMousePoint = (): Readonly<Point2D> => point;

/** How much the mouse was moved since last update. */
export const getMouseDelta = (): Readonly<Point2D> => delta;
