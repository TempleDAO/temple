import { Environment } from './types';

const env: Environment = {
  alchemyId: 'XiIZxWykHU5AOFBwxKgxseXWN984Mp8F',
  backendUrl: 'https://backend.templedao.link',
  contracts: {
    exitQueue: '0xC6d556C34a179a224AEBE42e77c6e76594148B97',
    faith: '0x78F683247cb2121B4eBfbD04110760da42752a6B',
    fei: '0x956F47F50A910163D8BF957Cf5846D573E7f87CA',
    frax: '0x853d955acef822db058eb8505911ed77f175b99e',
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
  sentry: {
    environment: 'production',
    dsn: 'https://ab0c41c30fbb405da50d9803819b1d60@o1268430.ingest.sentry.io/6456054',
  },
  subgraph: {
    templeCore: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-core',
    protocolMetrics: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-metrics',
  },
};

export default env;
