import { BigNumber, Contract } from 'ethers';

import balancerPoolAbi from 'data/abis/balancerPool.json';
import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';
import { useState } from 'react';
import useRequestState from 'hooks/use-request-state';

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
    try {
      const result = await poolContract!.setSwapEnabled(enabled, {
        gasLimit: 400000, // TODO: Proper gas limit?
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
    endWeight1: BigNumber,
    endWeight2: BigNumber
  ) => {
    console.log(endWeight1.toString());
    console.log(endWeight2.toString());
    try {
      setIsUpdateWeightsGraduallyLoading(true);
      const result = await poolContract!.updateWeightsGradually(
        startTime.getTime(),
        endTime.getTime(),
        [endWeight1, endWeight2],
        {
          gasLimit: 400000, // TODO: Proper gas limit?
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
