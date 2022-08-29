interface Subgraphs {
  templeCore: string;
  protocolMetrics: string;
}

interface Contracts {
  exitQueue: string;
  faith: string;
  farmingWallet: string;
  fei: string;
  frax: string;
  frax3CrvFarming: string;
  frax3CrvFarmingRewards: string;
  lockedOgTemple: string;
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
  infuraId: string;
  sentry?: Sentry;
  posthog?: Posthog;
  subgraph: Subgraphs;
}
