export interface Chain {
  id: number;
  name: string;
  transactionUrl(txhash: string): string;
  addressUrl(txhash: string): string;
}

export const MUMBAI: Chain = {
  id: 80001,
  name: 'Polygon Mumbai',
  transactionUrl(txhash: string) {
    return `https://mumbai.polygonscan.com/tx/${txhash}`;
  },
  addressUrl(address: string) {
    return `https://mumbai.polygonscan.com/address/${address}`;
  },
};

export const ARBITRUM: Chain = {
  id: 42161,
  name: 'Arbitrum',
  transactionUrl(txhash: string) {
    return `https://arbiscan.io/tx/${txhash}`;
  },
  addressUrl(address: string) {
    return `https://arbiscan.io/address/${address}`;
  },
};

export const MAINNET: Chain = {
  id: 1,
  name: 'Mainnet',
  transactionUrl(txhash: string) {
    return `https://etherscan.io/tx/${txhash}`;
  },
  addressUrl(address: string) {
    return `https://etherscan.io/address/${address}`;
  },
};

export const SEPOLIA: Chain = {
  id: 11155111,
  name: 'Sepolia',
  transactionUrl(txhash: string) {
    return `https://sepolia.etherscan.io/tx/${txhash}`;
  },
  addressUrl(address: string) {
    return `https://sepolia.etherscan.io/address/${address}`;
  },
};

const APP_CHAINS = [MAINNET, SEPOLIA, ARBITRUM, MUMBAI];

export const getChainById = (id: number) => {
  return APP_CHAINS.find((c) => c.id === id) || MAINNET;
};
