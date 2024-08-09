import { TICKER_SYMBOL } from './ticker-symbol';

export enum TempleAddress {
  fireRitual = '0xdc9d4685847f1c8bdd4ce86be6a83fa09b6a08b1',
  openingCeremony = '0xa2642df0139faebb1d45526a46d5c54b805be02c',
  templeStaking = '0x4d14b24edb751221b3ff08bbb8bd91d4b1c8bc77',
  ammRouter = '0x8a5058100e60e8f7C42305eb505b12785bba3bca',
  unstake = '0xc6d556c34a179a224aebe42e77c6e76594148b97',
  exitQueue = '0x967591888a5e8aed9d2a920fe4cc726e83d2bca9',
}

export const TEMPLE_ADDRESS_LABELS = {
  [TempleAddress.ammRouter]: `${TICKER_SYMBOL.TEMPLE_TOKEN} AMM Router`,
  [TempleAddress.openingCeremony]: 'Opening Ceremony',
  [TempleAddress.templeStaking]: `${TICKER_SYMBOL.TEMPLE_TOKEN} Staking`,
  [TempleAddress.fireRitual]: 'Fire Ritual',
  [TempleAddress.unstake]: 'Unstake',
  [TempleAddress.exitQueue]: 'Exit Queue',
};
