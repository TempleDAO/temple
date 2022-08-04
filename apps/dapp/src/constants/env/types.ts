interface Subgraphs {
  templeCore: string;
  protocolMetrics: string;
  balancerV2: string;
}

interface Contracts {
  exitQueue: string;
  faith: string;
  farmingWallet: string;
  fei: string;
  frax: string;
  frax3CrvFarming: string;
  frax3CrvFarmingRewards: string;
  ogTemple: string;
  teamPaymentsEpoch1: string;
  teamPaymentsEpoch2: string;
  teamPaymentsEpoch3: string;
  teamPaymentsEpoch4: string;
  temple: string;
  templeStaking: string;
  templeV2FraxPair: string;
  templeV2FeiPair: string;
  templeV2Router: string;
  treasuryIv: string;
  vaultOps: string;
  vaultProxy: string;
}

interface Gas {
  swapFraxForTemple: number;
  swapTempleForFrax: number;
  widthrawBase: number;
  widthrawPerEpoch: number;
  unstakeBase: number;
  unstakePerEpoch: number;
  restakeBase: number;
  restakePerEpoch: number;
  stake: number;
  claimOgTemple: number;
}

export interface Token {
  name: string;
  address: string;
  decimals: number;
  symbol?: string;
}

interface Tokens {
  frax: Token;
  temple: Token;
  ogTemple: Token;
  fei: Token;
  eth: Token;
  usdc: Token;
  dai: Token;
}

interface Sentry {
  environment: string;
  dsn: string;
}

export interface Environment {
  alchemyId: string;
  backendUrl: string;
  contracts: Contracts;
  gas?: Gas;
  fraxSellDisabledIvMultiple: number;
  tokens: Tokens;
  infuraId: string;
  sentry?: Sentry;
  subgraph: Subgraphs;
  templeMultisig: string;
  featureFlags: {
    enableAscend: boolean;
  };
}
