import { Environment } from './types';

const env: Environment = {
  subgraph: {
    templeCore: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-core',
  },
  contracts: {
    vaultProxy: '',
  },
  sentry: {
    environment: 'production',
    dsn: 'https://ab0c41c30fbb405da50d9803819b1d60@o1268430.ingest.sentry.io/6456054',
  },
};

export default env;