/* eslint-disable */

// ESLint does not allow for empty functions (no-ops) to be present in the code
// For the most part we want this to still be checked to keep the code clean but helpers.ts is an exception

export const noop = () => {};

export const asyncNoop = async () => {};
