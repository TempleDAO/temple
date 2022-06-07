import { Environment } from './types';

const env: Environment = {
  subgraph: {
    templeCore: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-core-rinkeby',
  },
  contracts: {},
  sentry: {
    environment: 'preview',
    dsn: 'https://ab0c41c30fbb405da50d9803819b1d60@o1268430.ingest.sentry.io/6456054',
  },
  infuraId: 'a2a39f8ae6564913a583c7b6d01c84d6',
};

export default env;
