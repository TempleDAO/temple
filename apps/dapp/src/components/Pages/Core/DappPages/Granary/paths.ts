import type { Auction, Token } from './data/types';
import { pairIdOf } from './data/derive';

// The Granary lives beside the live Spice Bazaar until the team switches over.
export const BASE = '/dapp/granary';

export const paths = {
  overview: BASE,
  earn: `${BASE}/earn`,
  auctions: (view?: 'chart') => `${BASE}/auctions${view ? '?view=chart' : ''}`,
  pair: (pairId: string, n?: number) =>
    `${BASE}/pair/${pairId}${n ? `?auction=${n}` : ''}`,
  auction: (a: Auction) =>
    paths.pair(pairIdOf(a.bidToken, a.fillToken), a.number),
  history: (pairId: string) => `${BASE}/pair/${pairId}/history`,
  wish: (give?: Token, get?: Token, amount?: number) =>
    `${BASE}/wish${
      give && get
        ? `?give=${give}&get=${get}${amount ? `&amount=${amount}` : ''}`
        : ''
    }`,
  activity: `${BASE}/activity`,
  legacy: `${BASE}/activity/legacy`,
  staking: '/dapp/spice/earn/staketemple/stake',
};
