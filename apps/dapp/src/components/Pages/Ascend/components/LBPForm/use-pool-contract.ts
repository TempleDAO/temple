import { Contract } from 'ethers';

import balancerPoolAbi from 'data/abis/balancerPool.json';
import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';
import { useState } from 'react';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';

export const usePoolContract = (pool?: Pool) => {
  const { signer } = useWallet();

  if (!pool || !signer) {
    return {
      setSwapEnabled: {
        handler: async () => {
          throw new Error('Wallet not connected');
        },
        isLoading: false,
        error: null,
      },
      updateWeightsGradually: {
        handler: async () => {
          throw new Error('Wallet not connected');
        },
        isLoading: false,
        error: null,
      },
    };
  }

  const [isSetSwapEnabledLoading, setIsSetSwapEnabledLoading] = useState(false);
  const [setSwapEnabledError, setSetSwapEnabledError] = useState<null | string>(null);

  const [isUpdateWeightsGraduallyLoading, setIsUpdateWeightsGraduallyLoading] = useState(false);
  const [updateWeightsGraduallyError, setUpdateWeightsGraduallyError] = useState<null | string>(null);

  const poolContract: Contract = new Contract(pool.address, balancerPoolAbi, signer);

  const setSwapEnabledHandler = async (enabled: boolean) => {
    setIsSetSwapEnabledLoading(true);
    setSetSwapEnabledError(null);
    try {
      const result = await poolContract!.setSwapEnabled(enabled, {
        gasLimit: 400000,
      });
      await result.wait();
    } catch (error: any) {
      console.error(error);
      setSetSwapEnabledError('Transaction failed.');
    } finally {
      setIsSetSwapEnabledLoading(false);
    }
  };

  const updateWeightsGraduallyHandler = async (
    startTime: Date,
    endTime: Date,
    endWeight1: DecimalBigNumber,
    endWeight2: DecimalBigNumber
  ) => {
    const endWeights = [endWeight1.value, endWeight2.value];
    try {
      setIsUpdateWeightsGraduallyLoading(true);
      setUpdateWeightsGraduallyError(null);
      const result = await poolContract!.updateWeightsGradually(
        startTime.getTime() / 1000,
        endTime.getTime() / 1000,
        endWeights,
        {
          gasLimit: 400000,
        }
      );
      await result.wait();
    } catch (error: any) {
      console.error(error);
      setUpdateWeightsGraduallyError('Transaction failed.');
    } finally {
      setIsUpdateWeightsGraduallyLoading(false);
    }
  };

  return {
    setSwapEnabled: {
      handler: setSwapEnabledHandler,
      isLoading: isSetSwapEnabledLoading,
      error: setSwapEnabledError,
    },
    updateWeightsGradually: {
      handler: updateWeightsGraduallyHandler,
      isLoading: isUpdateWeightsGraduallyLoading,
      error: updateWeightsGraduallyError,
    },
  };
};
