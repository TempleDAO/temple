import { Environment } from './types';

const ENV = import.meta.env;

const env: Environment = {
  alchemyId: 'VvVv_fBIiRSaTQzL9RQNybD5FSNvtK5c',
  backendUrl: 'http://localhost:3001',
  contracts: {
    exitQueue: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    faith: '0xBEc49fA140aCaA83533fB00A2BB19bDdd0290f25',
    farmingWallet: '',
    fei: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    frax: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
    frax3CrvFarming: '',
    frax3CrvFarmingRewards: '',
    ogTemple: '0x75537828f2ce51be7289709686A69CbFDbB714F1',
    teamPaymentsEpoch1: '0x82e01223d51Eb87e16A03E24687EDF0F294da6f1',
    teamPaymentsEpoch2: '0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650',
    teamPaymentsEpoch3: '0xcbEAF3BDe82155F56486Fb5a1072cb8baAf547cc',
    teamPaymentsEpoch4: '0x162A433068F51e18b7d13932F27e66a3f99E6890',
    temple: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    templeStaking: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    templeV2FraxPair: '0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d',
    templeV2FeiPair: '0xdbC43Ba45381e02825b14322cDdd15eC4B3164E6',
    templeV2Router: '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584',
    treasuryIv: '0x04C89607413713Ec9775E14b954286519d836FEf',
    vaultOps: '0x4C2F7092C2aE51D986bEFEe378e50BD4dB99C901',
    vaultProxy: '0xAA292E8611aDF267e563f334Ee42320aC96D0463',
  },
  fraxSellDisabledIvMultiple: 1.02,
  infuraId: 'a2a39f8ae6564913a583c7b6d01c84d6',
  subgraph: {
    templeCore: 'http://localhost:8000/subgraphs/name/templedao-core',
    protocolMetrics: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-metrics',
    balancerV2: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-goerli-v2',
  },
  tokens: {
    frax: {
      name: 'Frax',
      address: ENV.VITE_PUBLIC_STABLE_COIN_ADDRESS,
    },
    temple: {
      name: 'Temple',
      address: ENV.VITE_PUBLIC_TEMPLE_ADDRESS,
    },
    ogTemple: {
      name: 'OGTemple',
      address: ENV.VITE_PUBLIC_OG_TEMPLE_ADDRESS,
    },
    fei: {
      name: 'Fei',
      address: ENV.VITE_PUBLIC_FEI_ADDRESS,
    },
    eth: {
      name: 'WETH',
      address: '',
    },
    usdc: {
      name: 'USDC',
      address: ENV.VITE_PUBLIC_USDC_ADDRESS,
    },
    bal: {
      name: 'Bal',
      address: ENV.VITE_PUBLIC_BAL_ADDRESS,
    },
    dai: {
      name: 'Dai',
      address: ENV.VITE_PUBLIC_DAI_ADDRESS,
    },
  },
  featureFlags: {
    enableLBP: true,
  },
  templeMultisig: '',
};

export default env;
