import { ADDRESS_ZERO } from 'utils/bigNumber';
import { Environment } from './types';

const ENV_VARS = import.meta.env;
const BALANCER_SUBGRAPH_API_KEY = ENV_VARS.VITE_BALANCER_SUBGRAPH_API_KEY;
const ENABLE_SUBGRAPH_LOGS = ENV_VARS.VITE_ENABLE_SUBGRAPH_LOGS === 'true';

const env: Environment = {
  alchemyId: '-nNWThz_YpX1cGffGiz-lbSMu7dmp4GK',
  rpcUrl: 'https://rpc.ankr.com/eth',
  backendUrl: 'http://localhost:3001',
  tradeTokenListUrl:
    'https://sf294otxgnbicood.public.blob.vercel-storage.com/testnet-tokens-acdWvsxlYFCXUEjNZmcxd4DRB4fXAb.json',
  contracts: {
    balancerVault: '',
    farmingWallet: '',
    exitQueue: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
    faith: '0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f',
    frax: '',
    usdc: '',
    usdt: '',
    dai: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    usds: '',
    weth: '',
    frax3CrvFarming: '',
    frax3CrvFarmingRewards: '',
    lbpFactory: '',
    lockedOgTemple: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
    ogTemple: '0x94099942864EA81cCF197E9D71ac53310b1468D8',
    olympus: '',
    otcOffer: '',
    temple: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    templegold: '',
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
    templeDaiBalancerPool: '',
    balancerHelpers: '',
    strategies: {
      dsrBaseStrategy: '',
      ramosStrategy: '',
      templeStrategy: '',
      tlcStrategy: '',
      temploMayorGnosisStrategy: '',
      fohmoGnosisStrategy: '',
      daiSkyFarmBaseStrategy: '',
      cosechaSegundaStrategy: '',
    },
    daiCircuitBreaker: '',
    templeCircuitBreaker: '',
    spiceBazaar: {
      templeGoldStaking: '',
      daiGoldAuction: '',
      spiceAuctionFactory: '',
    },
  },
  infuraId: '4cd22916292d4fb6be156454978c326b',
  subgraph: {
    templeCore: 'http://localhost:8000/subgraphs/name/templedao-core',
    protocolMetrics:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-metrics/version/v0.1.4/api',
    protocolMetricsArbitrum:
      'https://api.studio.thegraph.com/query/76011/temple-metrics-arbitrum/version/latest',
    balancerV2: `https://gateway.thegraph.com/api/${BALANCER_SUBGRAPH_API_KEY}/subgraphs/id/C4ayEZP2yTXRAB8vSaTrgN4m9anTe9Mdm2ViyiAuV9TV`,
    ramos:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-ramos/api',
    templeV2:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-v2-mainnet/api',
    templeV2Balances:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-v2-balances/api',
    spiceBazaar: {
      eth: '',
      bera: '',
    },
  },
  intervals: {
    ascendData: 30_000,
    ascendQuote: 10_000,
  },
  etherscan: 'https://sepolia.etherscan.io',
  tokens: {
    tgld: {
      name: 'Temple Gold',
      address: '',
      decimals: 18,
    },
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
    usds: {
      name: 'USDS',
      address: '',
      decimals: 18,
      symbol: 'USDS',
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
  enableSubgraphLogs: ENABLE_SUBGRAPH_LOGS,
};

export default env;
