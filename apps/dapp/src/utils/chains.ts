import env from 'constants/env';

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

export const ARBITRUM_GOERLI_CHAIN: ChainDefinition = {
  id: 421611,
  token: 'ETH',
  name: 'Arbitrum Goerli',
  label: 'Arbitrum Goerli',
  rpcUrl: env.rpcUrl,
};
