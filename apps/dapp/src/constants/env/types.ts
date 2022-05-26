interface Subgraphs {
  templeCore: string;
}

interface Contracts {
  vaultProxy: string;
}

export interface Environment {
  subgraph: Subgraphs;
  contracts: Contracts;
}
