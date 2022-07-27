import { Contract } from 'ethers';

import balancerPoolAbi from 'data/abis/balancerPool.json';
import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';
import { useState } from 'react';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { useNotification } from 'providers/NotificationProvider';

export const usePoolContract = (pool?: Pool) => {
  const { signer } = useWallet();
  const { openNotification } = useNotification();

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
  const [isUpdateWeightsGraduallyLoading, setIsUpdateWeightsGraduallyLoading] = useState(false);

  const poolContract: Contract = new Contract(pool.address, balancerPoolAbi, signer);

  const setSwapEnabledHandler = async (enabled: boolean) => {
    setIsSetSwapEnabledLoading(true);
    let result;
    try {
      result = await poolContract!.setSwapEnabled(enabled, {
        gasLimit: 400000,
      });
      await result.wait();
      openNotification({
        title: `setSwapEnabled success.`,
        hash: result.hash,
      });
    } catch (error: any) {
      console.error(error);
      openNotification({
        title: `setSwapEnabled failed.`,
        hash: result.hash,
      });
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
    let result;
    try {
      setIsUpdateWeightsGraduallyLoading(true);
      result = await poolContract!.updateWeightsGradually(
        startTime.getTime() / 1000,
        endTime.getTime() / 1000,
        endWeights,
        {
          gasLimit: 400000,
        }
      );
      await result.wait();
      openNotification({
        title: `updateWeights success.`,
        hash: result.hash,
      });
    } catch (error: any) {
      console.error(error);
      openNotification({
        title: `updateWeights failed.`,
        hash: result.hash,
      });
    } finally {
      setIsUpdateWeightsGraduallyLoading(false);
    }
  };

  return {
    setSwapEnabled: {
      handler: setSwapEnabledHandler,
      isLoading: isSetSwapEnabledLoading,
    },
    updateWeightsGradually: {
      handler: updateWeightsGraduallyHandler,
      isLoading: isUpdateWeightsGraduallyLoading,
    },
  };
};
