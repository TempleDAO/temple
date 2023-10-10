import { parseEther } from 'ethers';
import { MAINNET } from '@/chains';
import { TlcBatchLiquidateConfig } from '@/tlc/batch-liquidate';

const TLC_BATCH_LIQUIDATE_CONFIG: TlcBatchLiquidateConfig = {
  CHAIN: MAINNET,
  WALLET_NAME: 'temple_automation',
  TLC_ADDRESS: '0xcbc0A8d5C7352Fe3625614ea343019e6d6b89031',
  ACC_LIQ_MAX_CHUNK_NO: 100,
  MIN_ETH_BALANCE_WARNING: parseEther('0.1'),
  GAS_LIMIT: 1_000_000n,
  SUBGRAPH_URL: 'https://api.thegraph.com/subgraphs/name/medariox/v2-mainnet',
};

export const CONFIG = {
  tlcBatchLiquidate: TLC_BATCH_LIQUIDATE_CONFIG,
};
