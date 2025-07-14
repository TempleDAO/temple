import { BigRational } from "@mountainpath9/big-rational";
import { Json, TaskContext } from "@mountainpath9/overlord-core";

// A value of some type, stored withing the overlord kv store
export interface KvPersistedValue<T> {
  get(): Promise<T | undefined>;
  set(v: T): Promise<void>;
  clear(): Promise<void>;
}

// A bidirectional mapping between a value of type T and a json value
export interface JsonBinding<T> {
  toJson(v: T): Json, 
  fromJson(jv: Json): T | undefined;
}
  

// Construct a kv persisted, typed value
export function kvPersistedValue<T>(ctx: TaskContext, kv_key: string, jb: JsonBinding<T>): KvPersistedValue<T> {
  async function get() {
    const jv = await ctx.kvGet(kv_key);
    if (jv === undefined) {
      return undefined;
    }
    return jb.fromJson(jv);
  }

  async function set(v: T) {
    await ctx.kvSet(kv_key, jb.toJson(v));
  }

  async function clear() {
    await ctx.kvClear(kv_key);
  }

  return { get, set, clear };
}

export const JB_DATE: JsonBinding<Date> = {
  toJson: (v: Date) => v.getTime(),
  fromJson: (jv: Json) => {
    if (typeof(jv) != 'number') {
      return undefined;
    }
    return new Date(jv);
  }
}

export const JB_NUMBER: JsonBinding<number> = {
  toJson: (v: number) => v,
  fromJson: (jv: Json) => {
    if (typeof(jv) != 'number') {
      return undefined;
    }
    return jv;
  }
}

export const JB_BIGRATIONAL: JsonBinding<BigRational> = {
  toJson: (v: BigRational) => {
    return {
      n: v.numerator.toString(),
      d: v.denominator.toString(),
    }
  },
  fromJson: (jv: Json) => {
    const jv1 = jv as {n: string, d: string};
    if (jv1.n === undefined || jv1.d === undefined) {
      return undefined;
    }
    return BigRational.from(BigInt(jv1.n), BigInt(jv1.d));
  }
}
