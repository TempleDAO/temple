import { checkIntersection } from 'line-intersect';
import { multiply } from 'mathjs';
import { Vec2, vec2 } from './vec2';
import { notNullGuard } from 'utils/helpers';
import { genReflectionMatrix, invertMatrix, transformPoint, transformPoints } from './matrix-helpers';
import { Line2, Shape2 } from './origami-types';

const EPSILON = 1e-8;

function getLineIntersection(l1: Line2, l2: Line2): Vec2 | null {
  const [p0, p1, p2, p3]: Vec2[] = [l1, l2].map(l => l.flat()).flat()
    .map(v => vec2.round(v, EPSILON));
  // points need to be rounded before passing to checkIntersection()
  const result = checkIntersection(
    p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y,
  );
  return result.type == 'intersecting' ? result.point : null;
}

// split a shape into two shapes by a line
// if the line does not intersect the shape, the original shape is returned
export function splitShape(shape: Shape2, line: Line2): { left: Shape2, right: Shape2 } {
  const { vertices, uv, uvTx } = shape;
  const split = splitShapeVertices(vertices, line);
  const uvInv = invertMatrix(uvTx);
  const leftShape: Shape2 = {
    vertices: split.left,
    uv: transformPoints(split.left, uvInv),
    uvTx: multiply(genReflectionMatrix(line), uvTx),
  };
  const rightShape = {
    vertices: split.right,
    uv: transformPoints(split.right, uvInv),
    uvTx,
  };
  return { left: leftShape, right: rightShape };
}

function splitShapeVertices(vertices: Vec2[], line: Line2): { left: Vec2[], right: Vec2[] } {
  const regions: [Vec2[], Vec2[]] = [[], []];
  let intersectCount = 0;
  for (let idx = 0; idx < vertices.length; idx++) {
    const vertex1 = vertices[idx];
    const vertex2 = vertices[(idx + 1) % vertices.length];
    const intersect = getLineIntersection(line, [vertex1, vertex2]);
    const region = regions[intersectCount % 2];
    region.push(vertex1);
    if (intersect && !vec2.equals(intersect, vertex1)) {
      region.push(intersect);
      intersectCount++;
      if (!vec2.equals(intersect, vertex2)) {
        const nextRegion = regions[intersectCount % 2];
        if (nextRegion.length == 0 || !vec2.equals(intersect, nextRegion[0])) {
          nextRegion.push(intersect);
        }
      }
    }
  }
  const [shapeA, shapeB] = intersectCount == 2 ? regions : [vertices, []];
  // console.log([
  //   `splitShapeVertices([${vec2.formatList(vertices)}], ${vec2.formatList(line, " - ")})`,
  //   `intersectCount: ${intersectCount}`,
  //   `shapeA: ${vec2.formatList(shapeA)}`,
  //   `shapeB: ${vec2.formatList(shapeB)}`,
  // ].join("\n"))
  if (sideOfLineForShape(line, shapeA) == 'left') {
    return { left: shapeA, right: shapeB };
  } else {
    return { left: shapeB, right: shapeA };
  }
}

export function splitShapes(shapes: Shape2[], line: Line2): { left: Shape2[], right: Shape2[] } {
  const result = {
    left: [] as Shape2[],
    right: [] as Shape2[],
  }
  shapes.forEach(shape => {
    const { left, right } = splitShape(shape, line);
    result.left.push(left);
    result.right.push(right);
  })
  return result;
}

// check which side a shape is on, returns null if the shape intersects the line
// it's ok for the shape to touch the line (i.e. some of the points are on the line)
// as long as all other points are on the same side of the line
function sideOfLineForShape(line: Line2, vertices: Vec2[]): 'left' | 'right' | null {
  const turns = vertices.map(pt => sideOfLineForPoint(line, pt))
    .filter(notNullGuard)
  for (let i = 1; i < turns.length; i++) {
    if (turns[i] != turns[i-1]) {
      return null;
    }
  }
  return turns[0];
}

// check which side of a line a point is on, returns null if the point is on the line
function sideOfLineForPoint(line: Line2, pt: Vec2): 'left' | 'right' | null {
  const [p1, p2] = line;
  const signedArea = (p1.x * (p2.y - pt.y) + p2.x * (pt.y - p1.y) + pt.x * (p1.y - p2.y)) / 2;
  const rounded = Math.round(signedArea / EPSILON) * EPSILON;
  if (rounded === 0) {
    return null;
  } else {
    return rounded < 0 ? 'left' : 'right';
  }
}

export function reflectShapeAcrossLine(shape: Shape2, line: Line2): Shape2 {
  const { vertices, uv, uvTx } = shape;
  return {
    vertices: vertices.map(pt => reflectPointAcrossLine(line, pt)).reverse(),
    uv: [...uv].reverse(),
    uvTx: uvTx,
  }
}

function reflectPointAcrossLine(line: Line2, point: Vec2): Vec2 {
  const reflectedPt = transformPoint(point, genReflectionMatrix(line));
  return vec2.round(reflectedPt, EPSILON);
}

export function getBisectingLine(line: Line2): Line2 {
  // Calculate midpoint
  const [a, b] = line;
  const midPoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  
  // Calculate direction vector AB
  const abDir = { x: b.x - a.x, y: b.y - a.y };

  // The perpendicular vector to AB in 2D can be obtained by swapping x and y and negating the new y
  const perpAB = { x: abDir.y, y: -abDir.x };

  // Normalizing the perpendicular vector to make it unit length
  const normPerp = vec2.normalize(perpAB);

  // The bisecting line of unit length will start at the midpoint and end at the midpoint + the normalized perpendicular vector
  const bisectingLine: Line2 = [
    {
      x: midPoint.x - normPerp.x,
      y: midPoint.y - normPerp.y,
    },
    {
      x: midPoint.x + normPerp.x,
      y: midPoint.y + normPerp.y,
    },
  ];
  return bisectingLine;
}

export function rotateLine([lineStart, lineEnd]: Line2, angleRad: number): Line2 {
  // Shift line to origin
  const shiftedEnd = vec2.subtract(lineEnd, lineStart);

  // Apply rotation
  const rotatedEnd = {
      x: shiftedEnd.x * Math.cos(angleRad) - shiftedEnd.y * Math.sin(angleRad),
      y: shiftedEnd.x * Math.sin(angleRad) + shiftedEnd.y * Math.cos(angleRad),
  };

  // Shift line back
  const newEnd = vec2.add(lineStart, rotatedEnd);
  
  return [lineStart, newEnd];
}

export function makeLineWithLength(line: Line2, length: number): Line2 {
  const [start, end] = line;
  const dir = vec2.normalize(vec2.subtract(end, start));
  return [start, vec2.add(start, vec2.scale(dir, length))];
}
