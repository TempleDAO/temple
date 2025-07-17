import { parseEther } from 'ethers';
import { Chain, TlcBatchLiquidateConfig } from '@/tlc/batch-liquidate';

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


export const TLC_BATCH_LIQUIDATE_CONFIG: TlcBatchLiquidateConfig = {
  CHAIN: MAINNET,
  WALLET_NAME: 'temple_automation',
  TLC_ADDRESS: '0xcbc0A8d5C7352Fe3625614ea343019e6d6b89031',
  ACC_LIQ_MAX_CHUNK_NO: 100,
  MIN_ETH_BALANCE_WARNING: parseEther('0.1'),
  GAS_LIMIT: 1_000_000n,
  SUBGRAPH_URL:
    'https://subgraph.satsuma-prod.com/a912521dd162/templedao/tlc-liquidations-mainnet/api',
  SUBGRAPH_RETRY_LIMIT: 3,
};
