import { ADDRESS_ZERO } from 'utils/bigNumber';
import { Environment } from './types';
import { RARITY_TYPE } from 'components/Pages/Nexus/types';

const env: Environment = {
  alchemyId: 'XiIZxWykHU5AOFBwxKgxseXWN984Mp8F',
  rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/AorwfDdHDsEjIX4HPwS70zkVjWqjv5vZ',
  backendUrl: 'https://backend.templedao.link',
  contracts: {
    balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    exitQueue: '0xC6d556C34a179a224AEBE42e77c6e76594148B97',
    faith: '0x78F683247cb2121B4eBfbD04110760da42752a6B',
    farmingWallet: '0x5C8898f8E0F9468D4A677887bC03EE2659321012',
    frax: '0x853d955acef822db058eb8505911ed77f175b99e',
    usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    dai: '0x6b175474e89094c44da98b954eedeac495271d0f',
    weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    frax3CrvFarming: '0xd632f22692fac7611d2aa1c0d552930d43caed3b',
    frax3CrvFarmingRewards: '0xB900EF131301B307dB5eFcbed9DBb50A3e209B2e',
    lbpFactory: '0x0F3e0c4218b7b0108a3643cFe9D3ec0d4F57c54e',
    lockedOgTemple: '0x879B843868dA248B1F2F53b4f8CC6e17e7E8b949',
    ogTemple: '0x879B843868dA248B1F2F53b4f8CC6e17e7E8b949',
    olympus: '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5',
    teamPayments: [],
    temple: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    templeStaking: '0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77',
    templeV2FraxPair: '0x6021444f1706f15465bEe85463BCc7d7cC17Fc03',
    templeV2Router: '0x98257C876ACe5009e7B97843F8c71b3AE795c71E',
    tlc: '0xcbc0A8d5C7352Fe3625614ea343019e6d6b89031',
    swap1InchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    treasuryIv: '0x22c2fE05f55F81Bf32310acD9a7C51c4d7b4e443',
    vaultOps: '0x65fE8BaBF7DA367b2B45cBD748F0490713f84828',
    vaultProxy: '0x6f5bB7cC4F3D6628d0095545552757AB377FE15C',
    vaultEarlyExit: '0x7C6f1b4891ff8CAcCeC97DbbD9Df3b773d88A03E',
    ramos: '0x8C18b1619362C1f89a688294db9EDbb7947a710f',
    ramosPoolHelper: '0x0bD02b31B3a6aFB335a4C62c53BfdDD38D388075',
    balancerHelpers: '0x5aDDCCa35b7A0D07C74063c48700C8590E87864E',
  },
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
  infuraId: '4cd22916292d4fb6be156454978c326b',
  intervals: {
    ascendData: 30_000,
    ascendQuote: 10_000,
  },
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
    ohm: {
      name: 'Olympus',
      address: '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5',
      decimals: 9,
    },
    eth: {
      name: 'ETH',
      address: ADDRESS_ZERO,
      decimals: 18,
    },
    weth: {
      name: 'WETH',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    usdc: {
      name: 'USDC',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    usdt: {
      name: 'USDT',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    dai: {
      name: 'DAI',
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      decimals: 18,
    },
  },
  network: 1,
  etherscan: 'https://arbiscan.io',
  subgraph: {
    templeCore: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-core',
    protocolMetrics: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-metrics',
    balancerV2: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-balancer-v2',
    ramos: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-ramos',
    // Original Balancer Subgraph
    // balancerV2: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2-beta',
  },
  featureFlags: {
    enableAscend: false,
    nexusOnlyMode: true,
  },
  posthog: {
    token: 'phc_pa9tsK76qoRqgsvMh9rDLtBKbOaawlwvJTLkcNDtxab',
    api_host: 'https://app.posthog.com',
  },
  templeMultisig: '0xe2Bb722DA825eBfFa1E368De244bdF08ed68B5c4',
  nexus: {
    templeRelicAddress: '0x2817F045D6a0c94af2aC1964A548Bd3f79E33AaD',
    templeShardsAddress: '0xd641b65438206A33a0832D0CD38be8e5Bdc6D935',
    templeSacrificeAddress: '0x300d96730c70bA3430eE413515B4016427946Ed0',
    templeToken: '0x6d2caf65163ff290ec2a362d6e413fae4643f90e',
    templePartnerMinterAddress: '0xad4a94ab62e10e77b5d13392cea6e2129967df4b',
    pathOfTemplarShardAddress: '',
    recipes: [
      // { id: 0, required_ids: [0, 1], required_amounts: [1, 1], reward_ids: [2], reward_amounts: [1] },
      // { id: 2, required_ids: [0, 1], required_amounts: [2, 3], reward_ids: [2], reward_amounts: [1] },
    ],
    shardMetadata: {
      1: {
        id: 1, //note: this has to align with the id on the contract side
        name: 'Tome of Knowledge',
        description: "Obtained for completing the Temple's Apocrypha.",
        originUrl: 'https://www.voxels.com/spaces/ecd16631-9db3-49d7-b8d6-08e28556a734/play?coords=W@30W,1S,32F',
        logoUrl: 'https://myst.mypinata.cloud/ipfs/QmZxyeEakU7nzExo4t7LEyZwpR8QX6ZdBV72fgrGdGNPvT',
        rarity: RARITY_TYPE.EPIC,
      },
      // 2: {
      //   id: 2,
      //   name: 'Sigil of Temple Enclave',
      //   description: 'Obtained from completing a pilgrimage through the Temple Gates',
      //   originUrl: 'https://echoingwhispers.link/',
      //   logoUrl: 'https://devzodiactemple.mypinata.cloud/ipfs/QmSnRGU8CXtsX7pfnDaZ39JN9bNFZzGF6hwUbSAaW1zDg7',
      //   rarity: RARITY_TYPE.EPIC,
      // },
    },
    quests: [
      // {
      //   id: '1',
      //   title: 'Path Of The Templar',
      //   origin: 'TempleDAO',
      //   linkUrl: 'https://nexus.echoingwhispers.link/nexus/relic/no-relic',
      //   description:
      //     'The weary Templar seeking safe harbor from the bitter storms of DeFi volatility begins to have fever dreams about a mythical Hall of Scriptures where they may gain knowledge and enlightenment. The intrepid Templar may explore 1 of 5 paths available to them which will grant access to an Enclave of their choosing based on their natural alignments. The paths to the Enclaves of Chaos, Mystery, Logic, Structure and Order stretch out into the distance. Which path will bring you to prosperity?',
      //   logoUrl: 'https://myst.mypinata.cloud/ipfs/QmU3yaVLhaWi75AUwi4zxMFbu7uM53Pa4duar7jHD2m4Gs/StructureRelic.gif',
      //   rewardIds: [2],
      //   rarity: RARITY_TYPE.EPIC,
      // },
      {
        id: '1',
        title: 'Temple Scholar',
        origin: 'TempleDAO',
        linkUrl: 'https://www.voxels.com/spaces/ecd16631-9db3-49d7-b8d6-08e28556a734/play?coords=W@30W,1S,32F',
        description:
          'A mysterious and sultry figure in the Hall of Scriptures will point you in the right direction to locate the ancient Temple Library. There you will embark on a quest for knowledge through ancient tomes hidden within the library walls. The path of the Scholar is long but rewarding.',
        logoUrl: 'https://myst.mypinata.cloud/ipfs/QmZxyeEakU7nzExo4t7LEyZwpR8QX6ZdBV72fgrGdGNPvT',
        rewardIds: [1],
        rarity: RARITY_TYPE.EPIC,
      },
    ],
  },
};

export default env;
