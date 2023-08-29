import { multiply } from 'mathjs';
import { Vector3 } from 'three';
import { notNullGuard } from 'utils/helpers';
import { reflectShapeAcrossLine, splitShapes } from './geometry-helpers';
import { matrixScale, matrixTranslate } from './matrix-helpers';
import { GeometryInfo, Layer, Line2 } from './origami-types';

export interface RenderInfo {
  key: number,
  fixed: GeometryInfo[],
  moving?: {
    rotation: { axis: Vector3, center: Vector3 },
    geoms: GeometryInfo[],
  }
}

export interface FoldingState {
  canUndo: boolean
  canRedo: boolean
}

export class FoldingEngine {

  private stateIdx = 0;
  private stateStack: { layers: Layer[], foldLine?: Line2 }[];

  constructor(size: number) {
    const r = size / 2;
    this.stateStack = [{
      layers: [{
        shapes: [{
          vertices: [ { x: -r, y: -r }, { x: r, y: -r }, { x: r, y: r }, { x: -r, y: r } ],
          uv: [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 } ],
          uvTx: multiply(matrixTranslate({ x: -r, y: -r }), matrixScale(size)),
        }],
        side: true,
      }],
    }];
  }

  fold(foldLine: Line2): RenderInfo | undefined {
    const { layers } = this.stateStack[this.stateIdx];
    const split = splitLayers(layers, foldLine);
    if (split.left[0]?.shapes[0]?.vertices.length && split.right[0]?.shapes[0]?.vertices.length) {
      this.setState(split.left, split.right, foldLine);
      return this.makeAnimatedRenderInfo({
        moving: split.left,
        fixed: split.right,
        foldLine,
      });
    }
    return;
  }

  unfold(): RenderInfo | undefined {
    if (this.stateIdx > 0) {
      const { layers, foldLine } = this.stateStack[--this.stateIdx];
      if (foldLine) {
        const { left, right } = splitLayers(layers, foldLine);
        const mirroredLeft = reflectLayersAcrossLine(left, foldLine);
        const reverseFoldLine = [...foldLine].reverse() as Line2;
        return this.makeAnimatedRenderInfo({ moving: mirroredLeft, fixed: right, foldLine: reverseFoldLine });
      }
    }
    return
  }

  refold(): RenderInfo | undefined {
    const { layers, foldLine } = this.stateStack[this.stateIdx];
    if (foldLine) {
      this.stateIdx++;
      const { left, right } = splitLayers(layers, foldLine);
      return this.makeAnimatedRenderInfo({ moving: left, fixed: right, foldLine });
    }
    return
  }

  getFixedRenderInfo(): RenderInfo {
    const { layers } = this.stateStack[this.stateIdx];
    const fixedGeoms = makeLayersGeomery(layers);
    return {
      key: this.stateIdx + 1000,
      fixed: fixedGeoms,
    }
  }

  resetStateStack() {
    this.stateStack.splice(1);
    return this.getFixedRenderInfo();
  }

  getFoldingState(): FoldingState {
    return {
      canUndo: this.stateIdx > 0,
      canRedo: this.stateIdx < this.stateStack.length - 1,
    }
  }

  getFoldingLines(): Line2[] {
    return this.stateStack.slice(0, this.stateIdx)
      .map((_, idx) => this.stateStack[idx].foldLine).filter(notNullGuard);
  }

  private setState(
    leftLayers: Layer[],
    rightLayers: Layer[],
    foldLine: Line2,
  ) {
    this.stateStack[this.stateIdx].foldLine = foldLine;
    
    const mirroredLeft = reflectLayersAcrossLine(leftLayers, foldLine);
    const layers = [...mirroredLeft, ...rightLayers];
    this.stateStack[++this.stateIdx] = { layers };
    this.stateStack.splice(this.stateIdx + 1);
  }

  private makeAnimatedRenderInfo(params: {
    moving: Layer[], fixed: Layer[], foldLine: Line2
  }): RenderInfo {
    const { moving, fixed, foldLine } = params;
    const movingGeoms = [
      ...makeLayersGeomery(moving),
      ...makeLayersGeomery(moving.map(reverseLayer)),
    ];
    const fixedGeoms = makeLayersGeomery(fixed);
    return {
      key: this.stateIdx,
      fixed: fixedGeoms,
      moving: {
        rotation: computeRotationInfo(foldLine),
        geoms: movingGeoms,
      }
    }
  }
}

function splitLayers(layers: Layer[], foldLine: Line2): { left: Layer[], right: Layer[] } {
  const split = { left: [] as Layer[], right: [] as Layer[] };
  layers.forEach(layer => {
    const { left, right } = splitShapes(layer.shapes, foldLine);
    if (left[0].vertices.length > 0) {
      split.left.push({ shapes: left, side: layer.side });
    }
    if (right[0].vertices.length > 0) {
      split.right.push({ shapes: right, side: layer.side });
    }
    // console.log([
    //   `Layer: ${layer.shapes.map(s => vec2.formatList(s.vertices)).join("\n    ")}`,
    //   `Line:  ${vec2.formatList(foldLine, " - ")}`,
    //   `Left:  ${left.map(s => vec2.formatList(s.vertices)).join("\n    ")}`,
    //   `Right: ${right.map(s => vec2.formatList(s.vertices)).join("\n    ")}`,
    // ].join("\n"));
  });
  return split;
}

function reflectLayersAcrossLine(layers: Layer[], foldLine: Line2): Layer[] {
  return layers
    .map(layer => ({
      shapes: layer.shapes.map(s => reflectShapeAcrossLine(s, foldLine)),
      side: !layer.side,
    }))
    .reverse();
}

function computeRotationInfo(line: Line2): { axis: Vector3, center: Vector3 } {
  // Define the line's start and end points
  const [lineStart, lineEnd] = line.map(v => new Vector3(v.x, v.y, 0));
  // Calculate the rotation axis and the center of rotation
  return {
    axis: new Vector3().subVectors(lineStart, lineEnd).normalize(),
    center: new Vector3().addVectors(lineStart, lineEnd).multiplyScalar(0.5),
  };
}

function makeLayersGeomery(layers: Layer[]): GeometryInfo[] {
  const geoms: GeometryInfo[][] = layers.map((layer, idx) => {
    const z = -idx * 0.001;
    return layer.shapes.map(shape => ({ shape, z, side: layer.side }));
  });
  return geoms.flat();
}

function reverseLayer(layer: Layer): Layer {
  return {
    shapes: layer.shapes.map(({ vertices, uv, uvTx }) => ({
       vertices: [...vertices].reverse(),
       uv: [...uv].reverse(),
       uvTx,
    })),
    side: !layer.side,
  }
}
