import type { Auction, Token } from './data/types';
import { pairIdOf } from './data/derive';

// The Granary lives beside the live Spice Bazaar until the team switches over.
export const BASE = '/dapp/granary';

export const paths = {
  overview: BASE,
  earn: `${BASE}/earn`,
  auctions: (view?: 'chart') => `${BASE}/auctions${view ? '?view=chart' : ''}`,
  pair: (pairId: string) => `${BASE}/pair/${pairId}`,
  // all of a pair's auctions; one auction is /auctions/<number>
  history: (pairId: string) => `${BASE}/pair/${pairId}/auctions`,
  auction: (a: Auction) =>
    `${paths.history(pairIdOf(a.bidToken, a.fillToken))}/${a.number}`,
  // your wish for a pair; amount only pre-fills the form for a new wish
  wish: (give?: Token, get?: Token, amount?: string) =>
    `${BASE}/wish${give && get ? `/${pairIdOf(give, get)}` : ''}${
      amount ? `?amount=${amount}` : ''
    }`,
  activity: `${BASE}/activity`,
  legacy: `${BASE}/activity/legacy`,
};
