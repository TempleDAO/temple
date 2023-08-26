import { multiply } from 'mathjs';
import { Vec2, vec2 } from "./vec2";
import { Line2, Matrix3 } from "./origami-types";


// A function that given a line, returns a transform matrix that would
// transform 2d points to the reflected position from the given line.
// the line does not need to be normalized or cross the origin.
export function genReflectionMatrix(line: Line2): Matrix3 {
  const moveToOrigin = matrixTranslate(vec2.scale(line[0], -1));
  const reflect = matrixReflect(vec2.subtract(line[1], line[0]));
  const moveBack = matrixTranslate(line[0]);
  return multiply(multiply(moveBack, reflect), moveToOrigin) as Matrix3;
}

// A function that transforms a 2d point by a matrix.
export function transformPoint(point: Vec2, matrix: Matrix3): Vec2 {
  const { x, y } = point;
  const [a, b, c] = matrix[0];
  const [d, e, f] = matrix[1];
  return {
    x: a * x + b * y + c,
    y: d * x + e * y + f,
  };
}

export function transformPoints<T extends Vec2[] = Vec2[]>(points: T, matrix: Matrix3): T {
  return points.map(pt => transformPoint(pt, matrix)) as T;
}

// A function that given a point, returns a matrix that would
// transform 2d points to the translated position from the given point.
export function matrixTranslate(pt: Vec2): Matrix3 {
  const { x, y } = pt;
  return [
    [1, 0, x],
    [0, 1, y],
    [0, 0, 1],
  ];
}

export function matrixReflect(dir: Vec2): Matrix3 {
  const { x: dx, y: dy } = vec2.normalize(dir);
  const d = dx * dx + dy * dy;
  const a = (dx * dx - dy * dy) / d;
  const b = 2 * dx * dy / d;
  return [
    [a, b, 0],
    [b, -a, 0],
    [0, 0, 1],
  ];
}

export function matrixScale(scale: number): Matrix3 {
  return [
    [scale, 0, 0],
    [0, scale, 0],
    [0, 0, 1],
  ];
}

export function invertMatrix(matrix: Matrix3): Matrix3 {
  const [a, b, c] = matrix[0];
  const [d, e, f] = matrix[1];
  const [g, h, i] = matrix[2];
  const det = a * e * i + b * f * g + c * d * h - c * e * g - b * d * i - a * f * h;
  return [
    [
      (e * i - f * h) / det,
      (c * h - b * i) / det,
      (b * f - c * e) / det,
    ],
    [
      (f * g - d * i) / det,
      (a * i - c * g) / det,
      (c * d - a * f) / det,
    ],
    [
      (d * h - e * g) / det,
      (b * g - a * h) / det,
      (a * e - b * d) / det,
    ],
  ]
}