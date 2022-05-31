import { Environment } from './types';

const env: Environment = {
  subgraph: {
    templeCore: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-core',
  },
  contracts: {
    vaultProxy: '0x348757a999881B2EEAd0239650cda9CD5Ca704B2',
  },
  sentry: {
    environment: 'preview',
    dsn: 'https://ab0c41c30fbb405da50d9803819b1d60@o1268430.ingest.sentry.io/6456054',
  },
};

export default env;
