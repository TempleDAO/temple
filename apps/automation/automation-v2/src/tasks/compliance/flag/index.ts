/**
 * Flag: per Deployment, flags every address in the Target set that isn't
 * Flagged yet, and raises Findings for what the Bot won't fix on its own.
 */
export { flagTask } from './task';
export type { FlaggedAddressesIndexConfig } from './flagged-addresses-index';
