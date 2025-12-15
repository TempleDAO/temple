import { parseEther } from 'viem';
import { Chain, TlcBatchLiquidateConfig } from '@/tlc/batch-liquidate';
import { mainnet } from 'viem/chains';

export const MAINNET: Chain = {
  chain: mainnet,
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
    'https://api.goldsky.com/api/public/project_cmgzm4q1q009c5np2angrczxw/subgraphs/tlc-liquidations-mainnet/prod/gn',
  SUBGRAPH_RETRY_LIMIT: 3,
};
