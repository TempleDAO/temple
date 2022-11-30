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
  usdc: string;
  usdt: string;
  dai: string;
  frax3CrvFarming: string;
  frax3CrvFarmingRewards: string;
  lbpFactory: string;
  lockedOgTemple: string;
  ogTemple: string;
  teamPaymentsEpoch1: string;
  teamPaymentsEpoch2: string;
  teamPaymentsEpoch3: string;
  teamPaymentsEpoch4: string;
  teamPaymentsEpoch5: string;
  teamPaymentsEpoch6: string;
  teamPaymentsEpoch7: string;
  teamPaymentsEpoch8: string;
  teamPaymentsEpoch9: string;
  temple: string;
  templeStaking: string;
  templeV2FraxPair: string;
  templeV2FeiPair: string;
  templeV2Router: string;
  swap1InchRouter: string;
  treasuryIv: string;
  vaultOps: string;
  vaultProxy: string;
  vaultEarlyExit: string;
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

export interface Tokens {
  frax: Token;
  temple: Token;
  ogTemple: Token;
  fei: Token;
  eth: Token;
  usdc: Token;
  usdt: Token;
  dai: Token;
}

interface Sentry {
  environment: string;
  dsn: string;
}

interface Posthog {
  token: string;
  api_host: string;
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
  posthog?: Posthog;
  subgraph: Subgraphs;
  templeMultisig: string;
  intervals: {
    ascendData: number;
    ascendQuote: number;
  };
  etherscan: string;
  featureFlags: {
    enableAscend: boolean;
  };
}
