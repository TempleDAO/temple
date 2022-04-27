import { Environment } from './types';

const development: Environment = {
  subgraph: {
    templeCore: 'http://localhost:8000/subgraphs/name/templedao-core',
  },
};

export default development;