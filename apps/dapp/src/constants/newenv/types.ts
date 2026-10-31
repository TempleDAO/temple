import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { Contract, providers, Signer } from 'ethers';

export type ChainId = number;
export type ContractAddress = string;

export type Chain = {
  name: string;
  id: number;
  rpcUrl: string;
  walletRpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  explorer: {
    transactionUrl: (hash: string) => string;
    tokenUrl: (hash: string) => string;
    contractUrl: (address: string, params: any) => string;
  };
  layer0EndpointId: number;
};

export type TokenConfig = {
  chainId: ChainId;
  name: string;
  address: ContractAddress | undefined;
  decimals: number;
  symbol: string;
};

export type SpiceAuctionConfig = {
  isActive: boolean;
  name: string;
  chainId: ChainId;
  auctionTokenSymbol: string;
  auctionToken: TokenConfig;
  templeGoldToken: TokenConfig;
  templeGoldTokenBalanceTickerSymbol: TICKER_SYMBOL;
  contractConfig: ContractConfig<Contract>;
  subgraphUrl: string;
};

// Temple Granary: FixedPriceAuction (cloned by FixedPriceAuctionFactory) and
// WishingWell. A zero address means not deployed on this chain yet.
export type GranaryConfig = {
  chainId: ChainId;
  factory: ContractConfig<Contract>;
  wishingWell: ContractConfig<Contract>;
  complianceCheck: ContractConfig<Contract>;
  // TODO(granary-subgraph): the indexer will list every auction from the
  // factory's AuctionCreated events. Until then the dapp reads these directly.
  auctions: ContractConfig<Contract>[];
  // Tokens the wish screen offers: any give → get pair of two of them.
  wishTokens: TokenConfig[];
  subgraphUrl: string;
};

export type AppConfig = {
  chains: Chain[];
  tokens: {
    templeToken: TokenConfig;
    ogTempleToken: TokenConfig;
    fraxToken: TokenConfig;
    usdcToken: TokenConfig;
    usdtToken: TokenConfig;
    daiToken: TokenConfig;
    usdsToken: TokenConfig;
    wethToken: TokenConfig;
    ohmToken: TokenConfig;
    templeGoldToken: TokenConfig; // TODO: Contract as a property
    templeGoldTokenBerachain?: TokenConfig;
    spiceTokenBerachain?: TokenConfig;
    templeGoldTokenArbitrum?: TokenConfig;
    spiceTokenArbitrum?: TokenConfig;
  };
  contracts: {
    templeGoldStaking: ContractConfig<Contract>;
    daiGoldAuction: ContractConfig<Contract>;
    templeGold: ContractConfig<Contract>;
    templeGoldBerachain?: ContractConfig<Contract>;
    templeGoldArbitrum?: ContractConfig<Contract>;
    tlc: ContractConfig<Contract>;
    trv: ContractConfig<Contract>;
    daiCircuitBreaker: ContractConfig<Contract>;
    templeCircuitBreaker: ContractConfig<Contract>;
  };
  spiceBazaar: {
    spiceAuctions: SpiceAuctionConfig[];
    tgldBridge: {
      active: boolean;
      sourceLayer0EndpointId: number;
      sourceTgldTokenContract: ContractConfig<Contract>;
      altchainLayer0EndpointId: number;
      altchainTgldTokenContract: ContractConfig<Contract>;
      altchainTgldTokenKey: TICKER_SYMBOL;
      altchainDisplayName: string;
    };
  };
  granary: GranaryConfig;
};

type contractFactory<T extends Contract> = {
  connect(address: string, signerOrProvider: Signer | providers.Provider): T;
};

export type ContractConfig<T extends Contract> = {
  address: string;
  contractFactory: contractFactory<T>;
  chainId: ChainId;
};
