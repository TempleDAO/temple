import { Environment } from './types';

const ENV = import.meta.env;

const env: Environment = {
  alchemyId: '-nNWThz_YpX1cGffGiz-lbSMu7dmp4GK',
  backendUrl: 'http://localhost:3001',
  contracts: {
    exitQueue: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    faith: '0xBEc49fA140aCaA83533fB00A2BB19bDdd0290f25',
    farmingWallet: '',
    fei: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    frax: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
    frax3CrvFarming: '',
    frax3CrvFarmingRewards: '',
    lbpFactory: '',
    lockedOgTemple: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    ogTemple: '0x75537828f2ce51be7289709686A69CbFDbB714F1',
    teamPaymentsEpoch1: '0x7969c5eD335650692Bc04293B07F5BF2e7A673C0',
    teamPaymentsEpoch2: '0xFD471836031dc5108809D173A067e8486B9047A3',
    teamPaymentsEpoch3: '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07',
    teamPaymentsEpoch4: '0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f',
    teamPaymentsEpoch5: '0x04C89607413713Ec9775E14b954286519d836FEf',
    teamPaymentsEpoch6: '',
    teamPaymentsEpoch7: '',
    teamPaymentsEpoch8: '',
    teamPaymentsEpoch9: '',
    temple: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    templeStaking: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    templeV2FraxPair: '0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d',
    templeV2FeiPair: '0xdbC43Ba45381e02825b14322cDdd15eC4B3164E6',
    templeV2Router: '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584',
    treasuryIv: '0x04C89607413713Ec9775E14b954286519d836FEf',
    vaultOps: '0x4C2F7092C2aE51D986bEFEe378e50BD4dB99C901',
    vaultProxy: '0xAA292E8611aDF267e563f334Ee42320aC96D0463',
    vaultEarlyExit: '',
  },
  fraxSellDisabledIvMultiple: 1.02,
  infuraId: '4cd22916292d4fb6be156454978c326b',
  subgraph: {
    templeCore: 'http://localhost:8000/subgraphs/name/templedao-core',
    protocolMetrics: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-metrics',
    balancerV2: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-balancer-v2',
    // Original Balancer Subgraph
    // balancerV2: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-goerli-v2',
  },
  intervals: {
    ascendData: 30_000,
    ascendQuote: 10_000,
  },
  etherscan: 'https://goerli.etherscan.io',
  tokens: {
    frax: {
      name: 'Frax',
      address: ENV.VITE_PUBLIC_STABLE_COIN_ADDRESS,
      decimals: 18,
      symbol: 'Frax',
    },
    temple: {
      name: 'Temple',
      address: ENV.VITE_PUBLIC_TEMPLE_ADDRESS,
      decimals: 18,
      symbol: 'Temple',
    },
    ogTemple: {
      name: 'OGTemple',
      address: ENV.VITE_PUBLIC_OG_TEMPLE_ADDRESS,
      decimals: 18,
      symbol: 'OGTemple',
    },
    fei: {
      name: 'Fei',
      address: ENV.VITE_PUBLIC_FEI_ADDRESS,
      decimals: 18,
      symbol: 'FEI',
    },
    eth: {
      name: 'WETH',
      address: '',
      decimals: 18,
      symbol: 'WETH',
    },
    usdc: {
      name: 'USDC',
      address: ENV.VITE_PUBLIC_USDC_ADDRESS,
      decimals: 6,
      symbol: 'USDC',
    },
    dai: {
      name: 'Dai',
      address: ENV.VITE_PUBLIC_DAI_ADDRESS,
      decimals: 18,
      symbol: 'DAI',
    },
  },
  featureFlags: {
    enableAscend: true,
  },
  templeMultisig: '0x3a320fF715dCBbF097e15257B7051dd08fdfb7A2',
};

export default env;
