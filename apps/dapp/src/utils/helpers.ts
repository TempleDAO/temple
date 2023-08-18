/* eslint-disable */

// ESLint does not allow for empty functions (no-ops) to be present in the code
// For the most part we want this to still be checked to keep the code clean but helpers.ts is an exception

const ENV = import.meta.env;

export const noop = () => {};

export const asyncNoop = async () => {};

export const isDevelopmentEnv = () => {
  return ENV.VITE_ENV === 'preview-nexus' || ENV.VITE_ENV === 'preview' || ENV.VITE_ENV === 'local';
};