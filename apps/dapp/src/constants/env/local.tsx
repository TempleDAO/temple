import { Environment } from './types';

const env: Environment = {
  subgraph: {
    templeCore: 'http://localhost:8000/subgraphs/name/templedao-core',
    protocolMetrics: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-metrics',
  },
  contracts: {},
  infuraId: 'a2a39f8ae6564913a583c7b6d01c84d6',
};

export default env;
