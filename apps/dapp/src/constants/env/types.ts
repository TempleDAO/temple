interface Subgraphs {
  templeCore: string;
}

interface Contracts {
  vaultProxy: string;
}

interface Sentry {
  environment: string;
  dsn: string; 
}

export interface Environment {
  subgraph: Subgraphs;
  contracts: Contracts;
  sentry?: Sentry;
}
