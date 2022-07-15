import { Environment } from './types';

// No longer active/unused
// PRESALE_ALLOCATION: '',
// PRESALE: '',
// SANDALWOOD_TOKEN: '', // not bridged onto polygon
// OPENING_CEREMONY: '',
// OPENING_CEREMONY_VERIFIER: '',
// AMM_WHITELIST: '',

// // From network/environment
// FRAX: '0x73651AD693531F9937528009cC204a4d9b696a68',
// //DAI: 0x2FF3E2b430e369dc7dd302A0F47DD1248412F9b0
// //FEI: 0xa1e7CdD887d6fac4861b5663984A9Ba72cFF9522

// // Active contrats
// TEMPLE: '0x5631d8eA427129e15bDa68F0F9227C149bD29Dcf',
// STAKING: '0x20Ab503De9859eecB22EaB0ddEc9Bcd8bAFB876C',
// LEGACY_LOCKED_OG_TEMPLE: '0x093679021DC1DbEa82E25479B3072FCf70ADbF57',
// TREASURY: '0xC1fc2C0b96465914a8a1Cf745303c5e06Ceb6045',

// // currently not configured, need to swap treasury owner via
// // multisig. Test on rinkeby before doing the same on mainnet
// TREASURY_MANAGEMENT: '',
// TEMPLE_TEAM_FIXED_PAYMENTS: '',
// TEMPLE_TEAM_EPOCH_2: '',
// TEMPLE_TEAM_EPOCH_4: '',
// TEMPLE_TEAM_CONTIGENT_PAYMENTS: '',
// TEMPLE_V2_PAIR: '0x85dA8c4312742522519911052Fa2B4aC302E4d6c', // Frax Pair
// //FEI Pair: 0xD83834165E2b130341d58dd5A43460B7f4C491BD
// TEMPLE_V2_ROUTER: '0x7a19509307648b0bf00dd7349F2dDaE716B9a998', 
// TEMPLE_AMM_OPS: '',
// TEMPLE_CASHBACK: '',

// FAITH: '0x2c20342F1B27Ca1E4e6668A623084Bb9fC086A4D',
// FAITH_AIRDROP: '',
// LOCKED_OG_TEMPLE: '0xab68BaC85196f72BD5Da062085F782F6c81492A2',
// DEVOTION: '0xd9946E1f106E41eD515c9E4C63F2962E7d498dE5',
// TEMPLE_IV_SWAP: '',

// OPS_MANAGER_LIB: '0xAE15c924aF55761Ae1bFe64b94B4Ee1c70ad8086',
// OPS_MANAGER: '0xCf19c5D73df8124bD12bC987AfaDB71Cc35e6A73',
// JOINING_FEE: '0x7B92B1542EcC27a86d53F83f9254383C938Bc4E7',
// INSTANT_EXIT_QUEUE: '0x3d7bCee8b9515a99437D3BEa7e6612a1467c6585',
// VAULT_PROXY: '0x6087B9b7DA7d2A7C5dB494e4B640E86FD3A9813D',

// MULTISIG: '0x3a320fF715dCBbF097e15257B7051dd08fdfb7A2',
const geoerli: Environment = {
  alchemyId: 'VvVv_fBIiRSaTQzL9RQNybD5FSNvtK5c',
  backendUrl: 'https://backend-stage.templedao.link',
  contracts: {
    exitQueue: '0x3d7bCee8b9515a99437D3BEa7e6612a1467c6585',
    faith: '0x2c20342F1B27Ca1E4e6668A623084Bb9fC086A4D',
    farmingWallet: '0x5C8898f8E0F9468D4A677887bC03EE2659321012',
    fei: '0xa1e7CdD887d6fac4861b5663984A9Ba72cFF9522',
    frax: '0x73651AD693531F9937528009cC204a4d9b696a68',
    frax3CrvFarming: '',
    frax3CrvFarmingRewards: '',
    ogTemple: '0x20Ab503De9859eecB22EaB0ddEc9Bcd8bAFB876C',
    teamPaymentsEpoch1: '0x7a770591f202D18e893DeC115f16DAE9d28686a8',
    teamPaymentsEpoch2: '',
    teamPaymentsEpoch3: '',
    teamPaymentsEpoch4: '',
    temple: '0x5631d8eA427129e15bDa68F0F9227C149bD29Dcf',
    templeStaking: '0x20Ab503De9859eecB22EaB0ddEc9Bcd8bAFB876C',
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
      address: '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C',
    },
    temple: {
      name: 'Temple',
      address: '0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54',
    },
    ogTemple: {
      name: 'OGTemple',
      address: '0xfF8D8342DC367D66BA20403216d55B1fcC1f284e',
    },
    fei: {
      name: 'Fei',
      address: '0xFc59F66a61A59c677d021DC01d5562A144C3D737',
    },
    eth: {
      name: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    usdc: {
      name: 'USDC',
      address: '',// ENV.VITE_PUBLIC_USDC_ADDRESS,
    },
    bal: {
      name: 'Bal',
      address: '', //ENV.VITE_PUBLIC_BAL_ADDRESS,
    },
    dai: {
      name: 'Dai',
      address: '', //ENV.VITE_PUBLIC_DAI_ADDRESS,
    },
  },
  sentry: {
    environment: 'preview',
    dsn: 'https://ab0c41c30fbb405da50d9803819b1d60@o1268430.ingest.sentry.io/6456054',
  },
  templeMultisig: '',
};

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
      address: '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C',
    },
    temple: {
      name: 'Temple',
      address: '0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54',
    },
    ogTemple: {
      name: 'OGTemple',
      address: '0xfF8D8342DC367D66BA20403216d55B1fcC1f284e',
    },
    fei: {
      name: 'Fei',
      address: '0xFc59F66a61A59c677d021DC01d5562A144C3D737',
    },
    eth: {
      name: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    usdc: {
      name: 'USDC',
      address: '',// ENV.VITE_PUBLIC_USDC_ADDRESS,
    },
    bal: {
      name: 'Bal',
      address: '', //ENV.VITE_PUBLIC_BAL_ADDRESS,
    },
    dai: {
      name: 'Dai',
      address: '', //ENV.VITE_PUBLIC_DAI_ADDRESS,
    },
  },
  sentry: {
    environment: 'preview',
    dsn: 'https://ab0c41c30fbb405da50d9803819b1d60@o1268430.ingest.sentry.io/6456054',
  },
  templeMultisig: '',
};

export default env;
