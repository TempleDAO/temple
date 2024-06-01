import { ADDRESS_ZERO } from 'utils/bigNumber';
import { Environment } from './types';

const env: Environment = {
  alchemyId: 'XiIZxWykHU5AOFBwxKgxseXWN984Mp8F',
  rpcUrl:
    'https://eth-mainnet.g.alchemy.com/v2/AorwfDdHDsEjIX4HPwS70zkVjWqjv5vZ',
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
    ogTemple: '0x654590F810f01B51dc7B86915D4632977e49EA33',
    olympus: '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5',
    otcOffer: '0x687A4B0Ac18Ed3796D55E6A1d747bD75591a8bac',
    // Preserve the order of this array: array index == epoch number. Append only.
    teamPayments: [
      {
        name: 'Epoch 1',
        address: '0xF7b10A0C780a3906D9A9F3d706EcD2624B6ED84e',
      },
      {
        name: 'Epoch 2',
        address: '0xe0Aafcf26576a53Cbec99481607FB53384909C36',
      },
      {
        name: 'Epoch 3',
        address: '0xf86C2dbD16F05E86bFf72cE89B3C2915812E92D0',
      },
      {
        name: 'Epoch 4',
        address: '0x07888e0a8929eb922Aee5930f7B0894BaB5D8120',
      },
      {
        name: 'Epoch 5',
        address: '0xc52101f2e278a316c70cc233486bce1863606920',
      },
      {
        name: 'Epoch 6',
        address: '0x91ad65e053ae98b4fbab84fc38b7bddd17c32cda',
      },
      {
        name: 'Epoch 7',
        address: '0x8cded928006feb238617fa5f7b04abeefcde36bf',
      },
      {
        name: 'Epoch 8',
        address: '0x008eCB3E53024628a5A8BbE0b142329791ad6f51',
      },
      {
        name: 'Epoch 9',
        address: '0x5461d7Cd3eEB184a83c5a1678335D72ccaf04818',
      },
      {
        name: 'Epoch 10',
        address: '0xdace5aa4D8E1E2678a2F2F6E96F31eBD599503DB',
      },
      {
        name: 'Epoch 11',
        address: '0x49fb6dbe198f61d8962cb069ca1bc7f2daff4de6',
      },
      {
        name: 'Epoch 12',
        address: '0x465451535c4518d805cbead0b95e1a1a677ddeae',
      },
      {
        name: 'Epoch 13',
        address: '0x8C45f988fD3A2657d2B32Ff5340D858370D408Ef',
      },
      {
        name: 'Epoch 14',
        address: '0x476Cba8D051f8F375D7E0aEFb09F74D13c777f23',
      },
      {
        name: 'Epoch 15',
        address: '0xc3B8080cB0b9bAeEc1c2Ca8B50BF80edf4f94eA9',
      },
      {
        name: 'Epoch 16',
        address: '0xb1a91c8f0a54cb0a2970423f83ec11bf9e414038',
      },
      {
        name: 'Epoch 17',
        address: '0xbA81DDf3152234d8BB47Fba24b371B70B629C276',
      },
      {
        name: 'Epoch 18',
        address: '0x71cA8E6da254582cDF1fA105c26bfa806913CE70',
      },
      {
        name: 'Epoch 19',
        address: '0x1931c748E8824205FacEB2AC069badacEd0AF4fc',
      },
      {
        name: 'Epoch 20',
        address: '0x215B8c5225fb43864ECfc15B7ac97fc78AE8f621',
      },
      {
        name: 'Epoch 21',
        address: '0xD50e540F9D4Da820eecA7428b5b5cECd2227727a',
      },
      {
        name: 'Epoch 22a',
        address: '0xDDbea74f5c53063e6c489d3a424e95c3c2BfB2cb',
      },
      {
        name: 'Epoch 22b',
        address: '0x9516E1ad540573a6704f2b7fbA165bC05821e552',
      },
      {
        name: 'Epoch 22c',
        address: '0x57cE4E4dcA88A5E1f3788D8e47c46687F91B6AfE',
      },
      {
        name: 'Epoch 23a',
        address: '0xC05C4123a4870293521980640ddFE37eb5c32dB6',
      },
      {
        name: 'Epoch 23b',
        address: '0xBd64922E156175972356D4Ef362b22a6806D61Ff',
      },
      {
        name: 'Epoch 23c',
        address: '0x5e6E4E6Eb6D45e4bC7837e483F106AE25FA52472',
      },
      {
        name: 'Epoch 24a',
        address: '0x85dFEC13117e3f7594e4e391F300E781f5609881',
      },
      {
        name: 'Epoch 24b',
        address: '0xc6E01D796C39CBbA16278a8C29e7C1267DC48A8f',
      },
    ],
    temple: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    templeStaking: '0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77',
    templeV2FraxPair: '0x6021444f1706f15465bEe85463BCc7d7cC17Fc03',
    templeV2Router: '0x98257C876ACe5009e7B97843F8c71b3AE795c71E',
    tlc: '0xcbc0A8d5C7352Fe3625614ea343019e6d6b89031',
    treasuryReservesVault: '0xf359Bae7b6AD295724e798A3Ef6Fa5109919F399',
    swap1InchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    treasuryIv: '0xae8a796bd9437Bd266664e8e9B8428B25A7D2477',
    vaultOps: '0x65fE8BaBF7DA367b2B45cBD748F0490713f84828',
    vaultProxy: '0x6f5bB7cC4F3D6628d0095545552757AB377FE15C',
    vaultEarlyExit: '0x24719d3AF60e1B622a29317d29E5Ce283617DeEC',
    ramos: '0xDdF499e726Bfde29Ce035F6B355e55757F08B5EF',
    ramosPoolHelper: '0xe32089bf9724aF09C026BeC36a7d8a81500cd58A',
    balancerHelpers: '0x5aDDCCa35b7A0D07C74063c48700C8590E87864E',
    strategies: {
      dsrBaseStrategy: '0x8b9e20D9970Af54fbaFe64049174e24d6DE0C412',
      ramosStrategy: '0xDA5CeF575eaEF14032C5006eb5cbEbE7eE0E347b',
      templeStrategy: '0xB8d09B0436adF927004Cea0B096E8c05f6dFdc3b',
      tlcStrategy: '0xcABDE42dd767361739bD7c09C6E574057080ef01',
      temploMayorGnosisStrategy: '0xb28FEC0EE90680EE25d42e8101159a72E359be7c',
      fohmoGnosisStrategy: '0xF179C63735690d2C08cfb231d15c0c7ac3A2Bc67',
    },
    daiCircuitBreaker: '0x02607d6bc3146bb3d3022e991ef54f545988fb7b',
    templeCircuitBreaker: '0x0745D453A19DfEAd0e5fd350a231D878F5c71b8D',
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
  etherscan: 'https://etherscan.io',
  subgraph: {
    // TODO: These need updated to the templedao organization subgraphs once they are deployed
    templeCore:
      'https://api.studio.thegraph.com/query/76011/temple-core/version/latest',
    protocolMetrics:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-metrics/api',
    protocolMetricsArbitrum:
      'https://api.studio.thegraph.com/query/76011/temple-metrics-arbitrum/version/latest',
    // TODO: This is not used anymore and should be removed
    balancerV2:
      'https://api.thegraph.com/subgraphs/name/templedao/templedao-balancer-v2',
    // TODO: Will be deprecated
    ramos: 'https://api.studio.thegraph.com/query/76011/temple-ramos/version/latest',
    templeV2:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-v2-mainnet/api',
    templeV2Balances:
      'https://subgraph.satsuma-prod.com/a912521dd162/templedao/temple-v2-balances/api',
    // Original Balancer Subgraph
    // balancerV2: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2-beta',
  },
  featureFlags: {
    enableAscend: false,
  },
  posthog: {
    token: 'phc_pa9tsK76qoRqgsvMh9rDLtBKbOaawlwvJTLkcNDtxab',
    api_host: 'https://app.posthog.com',
  },
  templeMultisig: '0xe2Bb722DA825eBfFa1E368De244bdF08ed68B5c4',
  safes: [
    // {
    //   name: 'Ethereum Mainnet Treasury',
    //   address: '0xb1BD5762fAf7D6F86f965a3fF324BD81bB746d00',
    // },
    // {
    //   name: 'DAO Runway',
    //   address: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',
    // },
    // {
    //   name: 'OLB:',
    //   address: '0x5C8898f8E0F9468D4A677887bC03EE2659321012',
    // },
    // {
    //   name: 'Temple Executors',
    //   address: '0x94b62A27a2f23CBdc0220826a8452fB5055cF273',
    // },
    // {
    //   name: 'Temple Rescuers',
    //   address: '0x9f90430179D9b67341BFa50559bc7B8E35629f1b',
    // },
  ],
};

export default env;
