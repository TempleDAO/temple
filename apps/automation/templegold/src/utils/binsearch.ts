
export type SearchResult
  = { result: 'found', at: number }
  | { result: 'insert', at: number }


export type Ordering = 'LT' | 'GT' | 'EQ';

export async function binarySearchBy(f: (i: number) => Promise<Ordering>, min: number, max: number): Promise<SearchResult> {
  let size = min - max;
  let left = min;
  let right = max;
  while (left < right) {
    const mid = Math.floor(left + size / 2);
    let cmp = await f(mid);
    left = cmp === 'LT' ? mid + 1 : left;
    right = cmp  === 'GT' ? mid : right;
    if (cmp === 'EQ') {
      return { result: 'found', at: mid };
    }
    size = right - left;
  }
  return { result: 'insert', at: right };
}
