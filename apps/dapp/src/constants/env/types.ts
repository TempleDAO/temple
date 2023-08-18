import { QuestData, Recipe, Shard } from 'components/Pages/Nexus/types';

interface Subgraphs {
  templeCore: string;
  protocolMetrics: string;
  balancerV2: string;
  ramos: string;
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
  weth: string;
  frax3CrvFarming: string;
  frax3CrvFarmingRewards: string;
  lbpFactory: string;
  lockedOgTemple: string;
  ogTemple: string;
  olympus: string;
  otcOffer: string;
  teamPayments?: string[];
  temple: string;
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
  ramosPoolHelper: string;
  balancerHelpers: string;
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
  eth: Token;
  weth: Token;
  usdc: Token;
  usdt: Token;
  dai: Token;
  ohm: Token;
}

interface Posthog {
  token: string;
  api_host: string;
}

interface Nexus {
  templeRelicAddress: string;
  templeShardsAddress: string;
  templeSacrificeAddress: string;
  templeToken: string;
  templePartnerMinterAddress: string;
  pathOfTemplarShardAddress: string;
  recipes: Recipe[];
  shardMetadata: {
    [key: number]: Shard;
  };
  quests: QuestData[];
}

export interface Environment {
  alchemyId: string;
  rpcUrl: string;
  backendUrl: string;
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
    nexusOnlyMode: boolean;
  };
  nexus: Nexus;
}
