import { ethers } from 'ethers';
import { Chain, SEPOLIA } from '@/chains';
import { CheckEthBalanceType } from '@/common/eth-auto-checker';
import { TlcBatchLiquidateConfig } from '@/tlc/batch-liquidate';

const CHECK_ETH_BALANCE_CONFIG: CheckEthBalanceType = (chain: Chain) => ({
  CHAIN: chain,
  WALLET_NAME: 'temple_automation_testnet',
  MIN_ETH_BALANCE: ethers.utils.parseEther('0.1'),
});

const TLC_BATCH_LIQUIDATE_CONFIG: TlcBatchLiquidateConfig = {
  CHAIN: SEPOLIA,
  WALLET_NAME: 'temple_automation_testnet',
  TLC_ADDRESS: '0xAe0A4a7690F5f308C6615E3738243Ab629DaEAEA',
};

export const CONFIG = {
  tlcBatchLiquidate: TLC_BATCH_LIQUIDATE_CONFIG,
  checkEthBalance: CHECK_ETH_BALANCE_CONFIG,
};
