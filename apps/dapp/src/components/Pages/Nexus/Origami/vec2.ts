export interface Vec2 {
  readonly x: number
  readonly y: number
}

export interface Dim2 {
  readonly width: number
  readonly height: number
}

export type Bounds2 = Vec2 & Dim2

export namespace vec2 {

  export function make(x: number, y: number): Vec2 {
    return { x, y }
  }
  
  export function toStr(v: Vec2) {
    return v.x + ',' + v.y
  }

  export function formatList(list: Vec2[], separator = ", ") {
    return list.map(v => `(${toStr(v)})`).join(separator)
  }

  export function lengthSq(v: Vec2) {
    return v.x * v.x + v.y * v.y
  }

  export function length(v: Vec2) {
    return Math.sqrt(lengthSq(v))
  }
  
  export function distSq(a: Vec2, b: Vec2) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return dx * dx + dy * dy
  }

  export function distance(a: Vec2, b: Vec2) {
    return Math.sqrt(distSq(a, b))
  }

  export function equals(a: Vec2, b: Vec2) {
    return a.x == b.x && a.y == b.y
  }

  export function offset(v: Vec2, dx: number, dy: number) : Vec2 {
    if (dx == 0 && dy == 0) {
      return v
    } else {
      return { x: v.x + dx, y: v.y + dy }
    }
  }

  export function add(a: Vec2, b: Vec2) {
    return { x: a.x + b.x, y: a.y + b.y }
  }

  export function subtract(a: Vec2, b: Vec2) {
    return { x: a.x - b.x, y: a.y - b.y }
  }

  export function clone(v: Vec2) {
    return { ...v }
  }

  export function quantize(v: Vec2, qX: number, qY?: number): Vec2 {
    return {
      x: Math.floor(v.x / qX) * qX,
      y: Math.floor(v.y / (qY ?? qX)) * (qY ?? qX),
    }
  }

  export function round(v: Vec2, qX: number, qY?: number): Vec2 {
    return {
      x: Math.round(v.x / qX) * qX,
      y: Math.round(v.y / (qY ?? qX)) * (qY ?? qX),
    }
  }

  export function scale(v: Vec2, scaleX: number, scaleY?: number): Vec2 {
    return { x: v.x * scaleX, y: v.y * (scaleY ?? scaleX) }
  }

  export function scaleDim(d: Dim2, scaleW: number, scaleH?: number): Dim2 {
    return { width: d.width * scaleW, height: d.height * (scaleH ?? scaleW) }
  }

  export function lerp(from: Vec2, to: Vec2, r: number) {
    const x = from.x + (to.x - from.x) * r
    const y = from.y + (to.y - from.y) * r
    return { x, y }
  }

  export function normalize(v: Vec2) {
    const len = length(v);
    return len == 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len }
  }

  export function perpendicular(v: Vec2) {
    return { x: -v.y, y: v.x }
  }

  export function contains(pt: Vec2, bounds: Bounds2) {
    const { x, y, width, height } = bounds
    return pt.x >= x && pt.x < x + width && pt.y >= y && pt.y < y + height
  }
}
