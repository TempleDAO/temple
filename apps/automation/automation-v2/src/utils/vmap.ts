/**
 * A Map with keys of arbitrary type K, and values of type V.
 *
 * The constructor is passed a function to map a value of type K to a string.
 */

export class VMap<K, V> {
    _values: { [key: string]: { k: K; v: V } };
  
    constructor(readonly keygen: (k: K) => string) {
      this._values = {};
    }
  
    static fromEntries<K, V>(
      keygen: (k: K) => string,
      entries: { k: K; v: V }[]
    ): VMap<K, V> {
      const vmap = new VMap<K, V>(keygen);
      for (const e of entries) {
        vmap.put(e.k, e.v);
      }
      return vmap;
    }
  
    get(k: K): V | undefined {
      return this._values[this.keygen(k)]?.v;
    }
  
    getOrCreate(k: K, vfn: () => V): V {
      const keystr = this.keygen(k);
      let existing = this._values[keystr];
      if (existing === undefined) {
        existing = { k, v: vfn() };
        this._values[keystr] = existing;
      }
      return existing.v;
    }
  
    async getOrCreateAsync (k: K, vfn: () => Promise<V>): Promise<V> {
      const keystr = this.keygen(k);
      let existing = this._values[keystr];
      if (existing === undefined) {
        existing = { k, v: await vfn() };
        this._values[keystr] = existing;
      }
      return existing.v;
    }
  
    put(k: K, v: V) {
      this._values[this.keygen(k)] = { k, v };
    }
  
    remove(k: K) {
      delete this._values[this.keygen(k)];
    }
  
    entries(): { k: K; v: V }[] {
      const result: { k: K; v: V }[] = [];
      for (const entry of Object.entries(this._values)) {
        result.push(entry[1]);
      }
      return result;
    }
  
    keys(): K[] {
      return Object.entries(this._values).map((e) => e[1].k);
    }
  
    values(): V[] {
      return Object.entries(this._values).map((e) => e[1].v);
    }
  
    size(): number {
      return Object.keys(this._values).length;
    }
  
    clear() {
      this._values = {};
    }
  
    // create a shallow copy
    copy(): VMap<K, V> {
      const result = new VMap<K, V>(this.keygen);
      result._values = { ...this._values };
      return result;
    }
  
    // Returns a shallow copy with an update
    withPut(k: K, v: V): VMap<K, V> {
      const m = this.copy();
      m.put(k, v);
      return m;
    }
  }