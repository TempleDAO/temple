interface Subgraphs {
  templeCore: string;
  protocolMetrics: string;
  protocolMetricsArbitrum: string;
  balancerV2: string;
  ramos: string;
  templeV2: string;
  // @dariox
  // the v2 contracts don't provide the means to query external balances
  // so when we have third party deposits we can't display them properly atm
  // and I don't want to add the "external balances" code to the current subgraph
  // because that data will be very volatile
  // basically this subgraph contains a subset of the above templeV2 with some
  // metric including the externally priced assets
  templeV2Balances: string;
  spiceBazaar: {
    eth: string;
    bera: string;
  };
}

interface Contracts {
  balancerVault: string;
  exitQueue: string;
  faith: string;
  farmingWallet: string;
  frax: string;
  usdc: string;
  usdt: string;
  dai: string;
  usds: string;
  weth: string;
  frax3CrvFarming: string;
  frax3CrvFarmingRewards: string;
  lbpFactory: string;
  lockedOgTemple: string;
  ogTemple: string;
  olympus: string;
  otcOffer: string;
  teamPayments?: { name: string; address: string }[];
  temple: string;
  templegold: string;
  templeStaking: string;
  templeV2FraxPair: string;
  templeV2Router: string;
  swap1InchRouter: string;
  tlc: string;
  treasuryReservesVault: string;
  treasuryIv: string;
  vaultOps: string;
  vaultProxy: string;
  vaultEarlyExit: string;
  ramos: string;
  strategies: {
    dsrBaseStrategy: string;
    ramosStrategy: string;
    templeStrategy: string;
    tlcStrategy: string;
    temploMayorGnosisStrategy: string;
    fohmoGnosisStrategy: string;
    daiSkyFarmBaseStrategy: string;
    cosechaSegundaStrategy: string;
  };
  ramosPoolHelper: string;
  templeDaiBalancerPool: string;
  balancerHelpers: string;
  daiCircuitBreaker: string;
  templeCircuitBreaker: string;
  spiceBazaar: SpiceBazaar;
}

interface SpiceBazaar {
  templeGoldStaking: string;
  daiGoldAuction: string;
  spiceAuctionFactory: string;
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
  logoURI?: string;
}

export interface Tokens {
  tgld: Token;
  frax: Token;
  temple: Token;
  ogTemple: Token;
  eth: Token;
  weth: Token;
  usdc: Token;
  usdt: Token;
  dai: Token;
  usds: Token;
  ohm: Token;
}

interface Posthog {
  token: string;
  api_host: string;
}

export interface SafeWallet {
  name: string;
  address: string;
}

export interface Environment {
  alchemyId: string;
  rpcUrl: string;
  backendUrl: string;
  tradeTokenListUrl: string;
  contracts: Contracts;
  gas?: Gas;
  tokens: Tokens;
  infuraId: string;
  posthog?: Posthog;
  subgraph: Subgraphs;
  templeMultisig: string;
  intervals: {
    ascendData: number;
    ascendQuote: number;
  };
  network: number;
  etherscan: string;
  featureFlags: {
    enableAscend: boolean;
  };
  safes: SafeWallet[];
  enableSubgraphLogs: boolean;
}
