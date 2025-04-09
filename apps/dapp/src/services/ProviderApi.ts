import {
  AppConfig,
  Chain,
  ChainId,
  ContractConfig,
  TokenConfig,
} from 'constants/newenv/types';
import { createMemoizedAsyncMap, MemoizedAsyncMap } from 'utils/memoized';
import { VMap } from 'utils/vmap';
import { BigNumber, Contract, providers, Signer } from 'ethers';

import { ERC20, ERC20__factory } from 'types/typechain';
import { logged } from './utils';
export type ProviderApi = {
  chains: VMap<ChainId, Chain>;
  providers: VMap<ChainId, providers.JsonRpcProvider>;
  tokens: MemoizedAsyncMap<TokenConfig, Contract>;
  contracts: MemoizedAsyncMap<ContractConfig<Contract>, Contract>;
  getProvider: (chainId: ChainId) => providers.JsonRpcProvider;
  getContract: <T extends Contract>(config: ContractConfig<T>) => Promise<T>;
  getConnectedContract: <T extends Contract>(
    config: ContractConfig<T>,
    signer: Signer
  ) => Promise<T>;
  getToken: (config: TokenConfig) => Promise<Contract>;
  getNativeBalance: (chainId: ChainId, address: string) => Promise<BigNumber>;
  getTokenBalance: (
    walletAddress: string,
    token: TokenConfig
  ) => Promise<BigNumber>;
};

export class ProviderApiImpl implements ProviderApi {
  chains: VMap<ChainId, Chain>;
  providers: VMap<ChainId, providers.JsonRpcProvider>;
  tokens: MemoizedAsyncMap<TokenConfig, Contract>;
  contracts: MemoizedAsyncMap<ContractConfig<Contract>, Contract>;

  constructor(readonly config: AppConfig) {
    this.chains = new VMap((c) => c.toString());

    for (const c of config.chains) {
      this.chains.put(c.id, c);
    }

    this.providers = new VMap<ChainId, providers.JsonRpcProvider>((cid) =>
      cid.toString()
    );

    this.tokens = createMemoizedAsyncMap(
      (tc) => tc.address + '/' + tc.chainId,
      (tc) => this.loadTokenContract(tc)
    );

    this.contracts = createMemoizedAsyncMap(
      (c) => c.address + '/' + c.chainId,
      (c) => this.loadContract(c)
    );
  }

  async getNativeBalance(chain: ChainId, address: string): Promise<BigNumber> {
    const provider = this.getProvider(chain);
    const balance = await provider.getBalance(address);
    return balance;
  }

  async getTokenBalance(
    walletAddress: string,
    token: TokenConfig
  ): Promise<BigNumber> {
    const tokenContract = (await this.getToken(token)) as ERC20;
    return tokenContract.balanceOf(walletAddress);
  }

  // TODO: Should we return a token? Or contract is Ok?
  async getToken(config: TokenConfig): Promise<Contract> {
    return this.tokens.get(config);
  }

  /**
   * Get a contract from the provider api.
   * If the contract is already loaded, it will be returned from the cache.
   * If the contract is not loaded, it will be loaded and then returned.
   *
   * @param config The contract config
   * @param options
   * @param options.ignoreCache If true, the contract will be loaded from the provider and not from the cache.
   * @returns The contract
   */
  async getContract<T extends Contract>(config: ContractConfig<T>): Promise<T> {
    return this.contracts.get(config) as unknown as T;
  }

  // TODO: Possibly move to signer API
  async getConnectedContract<T extends Contract>(
    config: ContractConfig<T>,
    signer: Signer
  ): Promise<T> {
    const contract = await this.getContract(config);
    return contract.connect(signer) as T;
  }

  async loadContract<T extends Contract>(
    config: ContractConfig<T>
  ): Promise<T> {
    return logged(this._loadContract(config), {
      label: 'loadContract',
      req: [config],
    });
  }

  async _loadContract<T extends Contract>(
    config: ContractConfig<T>
  ): Promise<T> {
    const provider = this.getProvider(config.chainId);
    if (provider === undefined) {
      throw new Error('No provider configured for chain id ' + config.chainId);
    }

    return config.contractFactory.connect(config.address, provider) as T;
  }

  async loadTokenContract(tc: TokenConfig): Promise<Contract> {
    const provider = this.getProvider(tc.chainId);
    if (provider === undefined) {
      throw new Error('No provider configured for chain id ' + tc.chainId);
    }
    if (tc.address === undefined) {
      throw new Error('Token address is undefined for token ' + tc.name);
    }
    return new Contract(tc.address, ERC20__factory.abi, provider);
  }

  getProvider(chainId: ChainId): providers.JsonRpcProvider {
    // use a cached provider if available
    // lazily load a new provider if not available
    let provider = this.providers.get(chainId);
    if (provider === undefined) {
      const chain = this.chains.get(chainId);
      if (chain === undefined) {
        throw new Error('No chain configured for chain id ' + chainId);
      }
      provider = new providers.JsonRpcProvider(chain.rpcUrl);
      this.providers.put(chainId, provider);
    }
    return provider;
  }
}

export function createProviderApi(config: AppConfig): ProviderApiImpl {
  return new ProviderApiImpl(config);
}
