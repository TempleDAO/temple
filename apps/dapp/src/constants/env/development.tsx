import { Environment } from './types';

const development: Environment = {
  graph: {
    handler: 'http://localhost:8000/subgraphs/name/templedao-core/graphql'
  },
};

export default development;