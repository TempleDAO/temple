import { BigNumber, Contract } from 'ethers';

import balancerPoolAbi from 'data/abis/balancerPool.json';
import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';

export const usePoolContract = (pool?: Pool) => {
  const { signer } = useWallet();

  if (!pool || !signer) {
    return {
      setSwapEnabled: async (enabled: boolean) => {
        throw new Error('Wallet not connected');
      },
      updateWeightsGradually: async () => {
        throw new Error('Wallet not connected');
      },
    };
  }

  const poolContract: Contract = new Contract(pool.address, balancerPoolAbi, signer);

  return {
    setSwapEnabled: async (enabled: boolean) => {
      return poolContract!.setSwapEnabled(enabled, {
        gasLimit: 400000,
      });
    },
    updateWeightsGradually: async (startTime: Date, endTime: Date, endWeight1: BigNumber, endWeight2: BigNumber) => {
      return poolContract!.updateWeightsGradually(startTime.getTime(), endTime.getTime(), [
        endWeight1,
        endWeight2,
        {
          gasLimit: 400000,
        },
      ]);
    },
  };
};
