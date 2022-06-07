interface Subgraphs {
  templeCore: string;
  protocolMetrics: string;
}

interface Contracts {}

interface Sentry {
  environment: string;
  dsn: string;
}

export interface Environment {
  subgraph: Subgraphs;
  contracts: Contracts;
  sentry?: Sentry;
  infuraId: string;
}
