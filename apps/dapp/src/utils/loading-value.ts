export type Loading<T> = { state: 'loading' } | { state: 'ready'; value: T };

export interface Reloadable<T> {
  value: Loading<T>;
  refresh(): void;
}

export function newLoading<T>(value: T | undefined): Loading<T> {
  if (value === undefined) {
    return { state: 'loading' };
  } else {
    return { state: 'ready', value };
  }
}

export function loading<T>(): Loading<T> {
  return { state: 'loading' };
}

export function ready<T>(value: T): Loading<T> {
  return { state: 'ready', value };
}

export function isReady<T>(
  value: Loading<T>
): value is { state: 'ready'; value: T } {
  return value.state === 'ready';
}

export function getValue<T>(l: Loading<T>): T | undefined {
  if (l.state === 'ready') {
    return l.value;
  }
}

export function getWithDefault<T>(lv: Loading<T>, defv: T): T {
  if (lv.state === 'loading') {
    return defv;
  }
  return lv.value;
}

export function lmap<A, B>(l: Loading<A>, f: (a: A) => B): Loading<B> {
  if (l.state === 'loading') {
    return loading();
  }
  return ready(f(l.value));
}

export function lmap2<A1, A2, B>(
  ls: [Loading<A1>, Loading<A2>],
  f: (a1: A1, a2: A2) => B
): Loading<B> {
  const [la1, la2] = ls;
  if (la1.state === 'loading' || la2.state === 'loading') {
    return loading();
  }
  return ready(f(la1.value, la2.value));
}

export function lmap3<A1, A2, A3, B>(
  ls: [Loading<A1>, Loading<A2>, Loading<A3>],
  f: (a1: A1, a2: A2, a3: A3) => B
): Loading<B> {
  const [la1, la2, la3] = ls;
  if (
    la1.state === 'loading' ||
    la2.state === 'loading' ||
    la3.state === 'loading'
  ) {
    return loading();
  }
  return ready(f(la1.value, la2.value, la3.value));
}
