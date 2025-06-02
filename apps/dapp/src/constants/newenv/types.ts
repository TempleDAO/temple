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
};

export type TokenConfig = {
  chainId: ChainId;
  name: string;
  address: ContractAddress | undefined;
  decimals: number;
  symbol: string;
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
    templeGoldToken: TokenConfig;
  };
  contracts: {
    templeGoldStaking: ContractConfig<Contract>;
    daiGoldAuction: ContractConfig<Contract>;
    templeGold: ContractConfig<Contract>;
    tlc: ContractConfig<Contract>;
    trv: ContractConfig<Contract>;
    daiCircuitBreaker: ContractConfig<Contract>;
    templeCircuitBreaker: ContractConfig<Contract>;
  };
};

type contractFactory<T extends Contract> = {
  connect(address: string, signerOrProvider: Signer | providers.Provider): T;
};

export type ContractConfig<T extends Contract> = {
  address: string;
  contractFactory: contractFactory<T>;
  chainId: ChainId;
};
