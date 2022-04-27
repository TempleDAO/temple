import { Environment } from './types';

const development: Environment = {
  graph: {
    vaultsHandler: 'http://localhost:8000/subgraphs/name/templedao-core/graphql'
  },
};

export default development;