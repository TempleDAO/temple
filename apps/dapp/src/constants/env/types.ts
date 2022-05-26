interface Subgraphs {
  templeCore: string;
}

interface Tokens {
  temple: string;
}

export interface Environment {
  subgraph: Subgraphs;
  tokens?: Tokens;
}