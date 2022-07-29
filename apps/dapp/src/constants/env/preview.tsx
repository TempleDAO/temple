import { Environment } from './types';

const env: Environment = {
  alchemyId: 'VvVv_fBIiRSaTQzL9RQNybD5FSNvtK5c',
  backendUrl: 'https://backend-stage.templedao.link',
  contracts: {
    exitQueue: '0x75a89f50cb40aec7Ed237F1Bfab562A60023ebE6',
    faith: '0x727d442f05cf22f3A60b787913623f406f9E94bA',
    farmingWallet: '0x5C8898f8E0F9468D4A677887bC03EE2659321012',
    fei: '0xFc59F66a61A59c677d021DC01d5562A144C3D737',
    frax: '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C',
    frax3CrvFarming: '',
    frax3CrvFarmingRewards: '',
    ogTemple: '0x564462C807600684965d8A8f57eA190F2F66169C',
    teamPaymentsEpoch1: '0x7a770591f202D18e893DeC115f16DAE9d28686a8',
    teamPaymentsEpoch2: '',
    teamPaymentsEpoch3: '',
    teamPaymentsEpoch4: '',
    temple: '0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54',
    templeStaking: '0xfF8D8342DC367D66BA20403216d55B1fcC1f284e',
    templeV2FraxPair: '0x57fd5b0CcC0Ad528050a2D5e3b3935c08F058Dca',
    templeV2FeiPair: '0x519462fD548D0Ba1e7d380Ed7F3DA10Cab912Fa7',
    templeV2Router: '0x459E8c845D5e11d50E5f42Cd51650a86aF1Af5B1',
    treasuryIv: '0xA443355cE4F9c1AA6d68e057a962E86E071B0ed3',
    vaultOps: '0x0647b5CFC9e9B03629Db83E7Aa4d1E25283DD9Cb',
    vaultProxy: '0x8adcc775251362B4E03e0437805BE3154C56b3F5',
  },
  subgraph: {
    templeCore: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-core-rinkeby',
    protocolMetrics: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-metrics',
    balancerV2: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-goerli-v2',
  },
  fraxSellDisabledIvMultiple: 1.02,
  gas: {
    swapFraxForTemple: 300000,
    swapTempleForFrax: 300000,
    widthrawBase: 180000,
    widthrawPerEpoch: 15000,
    unstakeBase: 300000,
    unstakePerEpoch: 16000,
    restakeBase: 350000,
    restakePerEpoch: 20000,
    stake: 150000,
    claimOgTemple: 100000,
  },
  infuraId: 'a2a39f8ae6564913a583c7b6d01c84d6',
  tokens: {
    frax: {
      name: 'Frax',
      address: '0x73651AD693531F9937528009cC204a4d9b696a68',
      decimals: 18,
    },
    temple: {
      name: 'Temple',
      address: '0x5631d8eA427129e15bDa68F0F9227C149bD29Dcf',
      decimals: 18,
    },
    ogTemple: {
      name: 'OGTemple',
      address: '0x564462C807600684965d8A8f57eA190F2F66169C',
      decimals: 18,
    },
    fei: {
      name: 'Fei',
      address: '0xa1e7CdD887d6fac4861b5663984A9Ba72cFF9522',
      decimals: 18,
    },
    eth: {
      name: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
    usdc: {
      name: 'USDC',
      address: '0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb',
      decimals: 6,
      symbol: 'USDC',
    },
    dai: {
      name: 'Dai',
      address: '0x8c9e6c40d3402480ace624730524facc5482798c',
      decimals: 18,
      symbol: 'DAI'
    },
  },
  sentry: {
    environment: 'preview',
    dsn: 'https://ab0c41c30fbb405da50d9803819b1d60@o1268430.ingest.sentry.io/6456054',
  },
  featureFlags: {
    enableAscend: true,
  },
  templeMultisig: '0x1a0ba3C8162d3039Dc095642889228903d6171d7',
};

export default env;
