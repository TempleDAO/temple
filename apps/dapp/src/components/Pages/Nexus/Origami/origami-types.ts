import { Vec2 } from "./vec2";

export type Pair<T> = [T, T];
export type Triple<T> = [T, T, T];

export type Line2 = Pair<Vec2>;

export type Matrix3 = Triple<Triple<number>>;

export interface Shape2 {
  vertices: Vec2[]
  uv: Vec2[]
  uvTx: Matrix3
}

export interface Layer {
  shapes: Shape2[]
  side: boolean
}

export interface GeometryInfo {
  shape: Shape2
  z: number
  side: boolean
}
