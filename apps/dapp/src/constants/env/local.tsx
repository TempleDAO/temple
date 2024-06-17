import { ADDRESS_ZERO } from 'utils/bigNumber';
import { Environment } from './types';

const ENV = import.meta.env;

const env: Environment = {
  alchemyId: '-nNWThz_YpX1cGffGiz-lbSMu7dmp4GK',
  rpcUrl:
    'https://eth-mainnet.g.alchemy.com/v2/AorwfDdHDsEjIX4HPwS70zkVjWqjv5vZ',
  backendUrl: 'http://localhost:3001',
  contracts: {
    balancerVault: '',
    farmingWallet: '',
    exitQueue: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
    faith: '0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f',
    frax: '',
    usdc: '',
    usdt: '',
    dai: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    weth: '',
    frax3CrvFarming: '',
    frax3CrvFarmingRewards: '',
    lbpFactory: '',
    lockedOgTemple: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
    ogTemple: '0x94099942864EA81cCF197E9D71ac53310b1468D8',
    olympus: '',
    otcOffer: '',
    temple: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    templeStaking: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
    templeV2FraxPair: '',
    templeV2Router: '',
    tlc: '',
    treasuryReservesVault: '',
    swap1InchRouter: '',
    treasuryIv: '',
    vaultOps: '0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E',
    vaultProxy: '0xf5059a5D33d5853360D16C683c16e67980206f36',
    vaultEarlyExit: '',
    ramos: '',
    ramosPoolHelper: '',
    balancerHelpers: '',
    strategies: {
      dsrBaseStrategy: '',
      ramosStrategy: '',
      templeStrategy: '',
      tlcStrategy: '',
      temploMayorGnosisStrategy: '',
      fohmoGnosisStrategy: '',
    },
    daiCircuitBreaker: '',
    templeCircuitBreaker: '',
  },
  infuraId: '4cd22916292d4fb6be156454978c326b',
  subgraph: {
    // TODO: These need updated to the templedao organization subgraphs once they are deployed
    templeCore: 'http://localhost:8000/subgraphs/name/templedao-core',
    protocolMetrics:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-metrics/api',
    protocolMetricsArbitrum:
      'https://api.studio.thegraph.com/query/76011/temple-metrics-arbitrum/version/latest',
    // TODO: This is not used anymore and should be removed
    balancerV2:
      'https://api.thegraph.com/subgraphs/name/templedao/templedao-balancer-v2',
    // TODO: Will be deprecated
    ramos: 'https://api.studio.thegraph.com/query/76011/temple-ramos/version/latest',
    // templeV2: 'https://api.studio.thegraph.com/query/520/v2-sepolia/version/latest',
    templeV2:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-v2-mainnet/api',
    templeV2Balances:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-v2-balances/api',

    // Original Balancer Subgraph
    // balancerV2: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-goerli-v2',
  },
  intervals: {
    ascendData: 30_000,
    ascendQuote: 10_000,
  },
  etherscan: 'https://sepolia.etherscan.io',
  tokens: {
    frax: {
      name: 'Frax',
      address: '',
      decimals: 18,
      symbol: 'Frax',
    },
    temple: {
      name: 'Temple',
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      decimals: 18,
      symbol: 'Temple',
    },
    ogTemple: {
      name: 'OGTemple',
      address: '0x94099942864EA81cCF197E9D71ac53310b1468D8',
      decimals: 18,
      symbol: 'OGTemple',
    },
    ohm: {
      name: 'Olympus',
      address: '',
      decimals: 9,
    },
    eth: {
      name: 'ETH',
      address: ADDRESS_ZERO,
      decimals: 18,
    },
    weth: {
      name: 'WETH',
      address: '',
      decimals: 18,
      symbol: 'WETH',
    },
    usdc: {
      name: 'USDC',
      address: '',
      decimals: 6,
      symbol: 'USDC',
    },
    usdt: {
      name: 'USDT',
      address: '',
      decimals: 6,
      symbol: 'USDT',
    },
    dai: {
      name: 'Dai',
      address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      decimals: 18,
      symbol: 'DAI',
    },
  },
  network: 30001,
  featureFlags: {
    enableAscend: true,
  },
  templeMultisig: '0x3a320fF715dCBbF097e15257B7051dd08fdfb7A2',
  safes: [
    // {
    //   name: 'Multisig Temple V2',
    //   address: 'sep:0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd',
    // },
    // {
    //   name: 'Multisig Test Fostrich',
    //   address: '0x5CE28cAE5aAb002DcBc076d5A551A473a7C9dF89',
    // },
  ],
};

export default env;
