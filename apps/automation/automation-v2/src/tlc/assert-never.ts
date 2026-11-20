/**
 * Ends an exhaustive switch. In its own module so pure code can use it
 * without `utils.ts`'s Discord and viem client imports.
 */
export function assertNever(x: never): never {
  throw new Error('Unexpected object: ' + x);
}
