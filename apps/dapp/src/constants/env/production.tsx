import { Environment } from './types';

const env: Environment = {
  alchemyId: 'XiIZxWykHU5AOFBwxKgxseXWN984Mp8F',
  backendUrl: 'https://backend.templedao.link',
  contracts: {
    exitQueue: '0xC6d556C34a179a224AEBE42e77c6e76594148B97',
    faith: '0x78F683247cb2121B4eBfbD04110760da42752a6B',
    farmingWallet: '0x5C8898f8E0F9468D4A677887bC03EE2659321012',
    fei: '0x956F47F50A910163D8BF957Cf5846D573E7f87CA',
    frax: '0x853d955acef822db058eb8505911ed77f175b99e',
    frax3CrvFarming: '0xd632f22692fac7611d2aa1c0d552930d43caed3b',
    frax3CrvFarmingRewards: '0xB900EF131301B307dB5eFcbed9DBb50A3e209B2e',
    lbpFactory: '0x751A0bC0e3f75b38e01Cf25bFCE7fF36DE1C87DE',
    ogTemple: '0x879B843868dA248B1F2F53b4f8CC6e17e7E8b949',
    teamPaymentsEpoch1: '0xF7b10A0C780a3906D9A9F3d706EcD2624B6ED84e',
    teamPaymentsEpoch2: '0xe0Aafcf26576a53Cbec99481607FB53384909C36',
    teamPaymentsEpoch3: '0xf86C2dbD16F05E86bFf72cE89B3C2915812E92D0',
    teamPaymentsEpoch4: '0x07888e0a8929eb922Aee5930f7B0894BaB5D8120',
    temple: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    templeStaking: '0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77',
    templeV2FraxPair: '0x6021444f1706f15465bEe85463BCc7d7cC17Fc03',
    templeV2FeiPair: '0xf994158766e0a4E64c26feCE675186f489EC9107',
    templeV2Router: '0x98257C876ACe5009e7B97843F8c71b3AE795c71E',
    treasuryIv: '0x22c2fE05f55F81Bf32310acD9a7C51c4d7b4e443',
    vaultOps: '0x65fE8BaBF7DA367b2B45cBD748F0490713f84828',
    vaultProxy: '0x6f5bB7cC4F3D6628d0095545552757AB377FE15C',
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
      address: '0x853d955acef822db058eb8505911ed77f175b99e',
      decimals: 18,
    },
    temple: {
      name: 'Temple',
      address: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
      decimals: 18,
    },
    ogTemple: {
      name: 'OGTemple',
      address: '0x654590f810f01b51dc7b86915d4632977e49ea33',
      decimals: 18,
    },
    fei: {
      name: 'Fei',
      address: '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
      decimals: 18,
    },
    eth: {
      name: 'WETH',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    usdc: {
      name: 'USDC',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    dai: {
      name: 'Dai',
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      decimals: 18,
    },
  },
  sentry: {
    environment: 'production',
    dsn: 'https://ab0c41c30fbb405da50d9803819b1d60@o1268430.ingest.sentry.io/6456054',
  },
  subgraph: {
    templeCore: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-core',
    protocolMetrics: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-metrics',
    balancerV2: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
  },
  featureFlags: {
    enableAscend: true,
  },
  posthog: {
    token: 'phc_pa9tsK76qoRqgsvMh9rDLtBKbOaawlwvJTLkcNDtxab',
    api_host: 'https://app.posthog.com',
  },
  templeMultisig: '0xe2Bb722DA825eBfFa1E368De244bdF08ed68B5c4',
};

export default env;
