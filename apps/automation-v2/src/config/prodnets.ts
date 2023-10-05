import { parseEther } from 'ethers';
import { Chain, MAINNET } from '@/chains';
import { CheckEthBalanceType } from '@/common/eth-auto-checker';
import { TlcBatchLiquidateConfig } from '@/tlc/batch-liquidate';

const CHECK_ETH_BALANCE_CONFIG: CheckEthBalanceType = (chain: Chain) => ({
  CHAIN: chain,
  WALLET_NAME: 'temple_automation',
  MIN_ETH_BALANCE: parseEther('0.1'),
});

const TLC_BATCH_LIQUIDATE_CONFIG: TlcBatchLiquidateConfig = {
  CHAIN: MAINNET,
  WALLET_NAME: 'temple_automation',
  TLC_ADDRESS: '0xcbc0A8d5C7352Fe3625614ea343019e6d6b89031',
  ACC_LIQ_MAX_CHUNK_NO: 100,
  MIN_ETH_BALANCE: parseEther('0.05'),
  GAS_LIMIT: 1_000_000n,
  SUBGRAPH_URL: 'https://api.thegraph.com/subgraphs/name/medariox/v2-mainnet',
};

export const CONFIG = {
  tlcBatchLiquidate: TLC_BATCH_LIQUIDATE_CONFIG,
  checkEthBalance: CHECK_ETH_BALANCE_CONFIG,
};
