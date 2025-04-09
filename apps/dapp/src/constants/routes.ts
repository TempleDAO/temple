/**
 * Routes that should not trigger the wrong network popover
 * These routes are network agnostic and can work with any chain
 */
export const NETWORK_AGNOSTIC_ROUTE_PATTERNS = [
  '/dapp/spice', // Spice Bazaar features
  '/dapp/borrow', // Borrow features
  '/dapp/dashboard', // Dashboard features
  '/dapp/trade', // Trade features
] as const;
