import env from 'constants/env';

export const ENV_CHAIN_MAPPING = new Map<string, ChainDefinition>();

export type ChainDefinition = {
  id: number;
  name: string;
  label: string;
  token: string;
  rpcUrl: string;
};

export const MAINNET_CHAIN: ChainDefinition = {
  id: 1,
  name: 'Ethereum',
  label: 'Ethereum Mainnet',
  token: 'ETH',
  rpcUrl: env.rpcUrl,
};

export const SEPOLIA_CHAIN: ChainDefinition = {
  id: 11155111,
  name: 'Sepolia',
  label: 'Sepolia',
  token: 'SEP',
  rpcUrl: env.rpcUrl,
};

export const LOCAL_CHAIN: ChainDefinition = {
  id: 31337,
  name: 'Hardhat',
  label: 'Local hardhat',
  token: 'ETH',
  rpcUrl: 'http://localhost:8545',
};

export const ARBITRUM_CHAIN: ChainDefinition = {
  id: 42161,
  token: 'ETH',
  name: 'Arbitrum',
  label: 'Arbitrum',
  rpcUrl: env.rpcUrl,
};

export const ARBITRUM_SEPOLIA_CHAIN: ChainDefinition = {
  id: 421614,
  token: 'ETH',
  name: 'Arbitrum Sepolia',
  label: 'Arbitrum Sepolia',
  rpcUrl: env.rpcUrl,
};

export const ARBITRUM_GOERLI_CHAIN: ChainDefinition = {
  id: 421611,
  token: 'ETH',
  name: 'Arbitrum Goerli',
  label: 'Arbitrum Goerli',
  rpcUrl: env.rpcUrl,
};

export const BERACHAIN_BEPOLIA_CHAIN: ChainDefinition = {
  id: 80069,
  token: 'ETH',
  name: 'Berachain Bepolia',
  label: 'Berachain Bepolia',
  rpcUrl: env.rpcUrl, // TODO: Fixme
};

export const BERACHAIN_MAINNET_CHAIN_CHAIN: ChainDefinition = {
  id: 80094,
  token: 'ETH',
  name: 'Berachain',
  label: 'Berachain',
  rpcUrl: env.rpcUrl, // TODO: Fixme
};

// TODO: Try to centralize with newenv
const APP_CHAINS = [
  MAINNET_CHAIN,
  SEPOLIA_CHAIN,
  LOCAL_CHAIN,
  ARBITRUM_CHAIN,
  ARBITRUM_GOERLI_CHAIN,
  BERACHAIN_BEPOLIA_CHAIN,
  BERACHAIN_MAINNET_CHAIN_CHAIN,
  ARBITRUM_SEPOLIA_CHAIN,
];

export const getChainById = (id: string) => {
  const _id = parseInt(id, 16);
  return (
    (APP_CHAINS.find(
      (chainDefinition) => chainDefinition.id === _id
    ) as ChainDefinition) || MAINNET_CHAIN
  );
};

export const APP_CHAINS_FOR_WEB3_INIT = APP_CHAINS.map((chainDefinition) => ({
  id: `0x${chainDefinition.id.toString(16)}`,
  token: chainDefinition.token,
  label: chainDefinition.label,
  rpcUrl: chainDefinition.rpcUrl,
}));

ENV_CHAIN_MAPPING.set('production', MAINNET_CHAIN);
ENV_CHAIN_MAPPING.set('preview', SEPOLIA_CHAIN);
ENV_CHAIN_MAPPING.set('local', LOCAL_CHAIN);

export const isSupportedChain = (chainId: number) => {
  return Array.from(ENV_CHAIN_MAPPING).some(
    ([_, chainDefinition]) => chainDefinition.id === chainId
  );
};
