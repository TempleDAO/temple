import { ADDRESS_ZERO } from 'utils/bigNumber';
import { Environment } from './types';

const env: Environment = {
  alchemyId: 'AorwfDdHDsEjIX4HPwS70zkVjWqjv5vZ',
  rpcUrl:
    'https://eth-mainnet.g.alchemy.com/v2/AorwfDdHDsEjIX4HPwS70zkVjWqjv5vZ',
  backendUrl: 'https://backend-stage.templedao.link',
  contracts: {
    balancerVault: '',
    exitQueue: '',
    faith: '',
    farmingWallet: '',
    frax: '',
    usdc: '',
    usdt: '',
    dai: '0x33FA9618365F67c5345066d5Cfd7f3A2f183599A',
    weth: '',
    frax3CrvFarming: '',
    frax3CrvFarmingRewards: '',
    lockedOgTemple: '',
    lbpFactory: '',
    ogTemple: '',
    olympus: '0xf7f739Bb945880aD0398122069Fd3beC282c6621',
    otcOffer: '0x09fdf85893c1277bdc9ef1be2acdf29ee5e19771',
    temple: '0x64a925B0fA211c44337148C0807f959Bd44b0B67',
    templeStaking: '',
    templeV2FraxPair: '',
    templeV2Router: '',
    tlc: '0xAe0A4a7690F5f308C6615E3738243Ab629DaEAEA',
    treasuryReservesVault: '0x7f19419488274bcC363d93F70809cDd53C788aF7',
    swap1InchRouter: '',
    treasuryIv: '',
    vaultOps: '',
    vaultProxy: '',
    vaultEarlyExit: '',
    ramos: '0x82ce000a51E8474378f7b555bcC4de5992052452',
    ramosPoolHelper: '0xbfC24c9d7D57C413618CE11cea1e313a2E8D9e1d',
    balancerHelpers: '0xdAE7e32ADc5d490a43cCba1f0c736033F2b4eFca',
    strategies: {
      dsrBaseStrategy: '0x472C7cDb6E730ff499E118dE6260c6b44c61d7bf',
      ramosStrategy: '0xB9507b59f91FF320631d30f774142631b30C537A',
      templeStrategy: '0xECe4ff1bd589b488350557A5C36D823C7B47E82F',
      tlcStrategy: '0x415A9B41700AC645d9C22F2499a6E853b625F792',
      temploMayorGnosisStrategy: '',
      fohmoGnosisStrategy: '',
    },
    daiCircuitBreaker: '0x30AC664062f58b6E4DF187713a2352385633B739',
    templeCircuitBreaker: '0x8f783c4A3d90712A794d5660b632AC67611852aF',
  },
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
    // balancerV2: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-goerli-v2',
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
      address: '0x73651AD693531F9937528009cC204a4d9b696a68',
      decimals: 18,
      symbol: 'FRAX',
    },
    temple: {
      name: 'Temple',
      address: '0x64a925B0fA211c44337148C0807f959Bd44b0B67',
      decimals: 18,
      symbol: 'TEMPLE',
    },
    ogTemple: {
      name: 'OGTemple',
      address: '0x07d6c81fce4263ddeb0610c217c673b315e766f1',
      decimals: 18,
      symbol: 'OGTEMPLE',
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
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
      symbol: 'WETH',
    },
    usdc: {
      name: 'USDC',
      address: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
      decimals: 6,
      symbol: 'USDC',
    },
    usdt: {
      name: 'USDT',
      address: '',
      decimals: 6,
    },
    dai: {
      name: 'DAI',
      address: '0x33FA9618365F67c5345066d5Cfd7f3A2f183599A',
      decimals: 18,
      symbol: 'DAI',
    },
  },
  network: 11155111,
  etherscan: 'https://sepolia.etherscan.io',
  featureFlags: {
    enableAscend: true,
  },
  templeMultisig: '0x3a320fF715dCBbF097e15257B7051dd08fdfb7A2',
  safes: [
    // {
    //   name: 'Multisig Temple V2',
    //   address: '0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd',
    // },
    // {
    //   name: 'Multisig Test Fostrich',
    //   address: '0x5CE28cAE5aAb002DcBc076d5A551A473a7C9dF89',
    // },
  ],
};

export default env;
