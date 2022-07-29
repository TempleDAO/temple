import { Contract } from 'ethers';

import balancerPoolAbi from 'data/abis/balancerPool.json';
import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';
import { useEffect, useState } from 'react';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { useNotification } from 'providers/NotificationProvider';
import useRequestState from 'hooks/use-request-state';

export const usePoolContract = (pool?: Pool) => {
  const { signer, wallet } = useWallet();
  const { openNotification } = useNotification();
  const [constractInstance, setContractInstance] = useState<Contract>();

  useEffect(() => {
    if (!signer || constractInstance || !pool) {
      return;
    }

    setContractInstance(new Contract(pool.address, balancerPoolAbi, signer));
  }, [signer, constractInstance, pool, setContractInstance]);

  const setSwapEnabledHandler = async (enabled: boolean) => {
    let result;
    try {
      result = await constractInstance!.setSwapEnabled(enabled, {
        gasLimit: 400000,
      });
      await result.wait();
      openNotification({
        title: `setSwapEnabled success.`,
        hash: result.hash,
      });
    } catch (error: any) {
      openNotification({
        title: `setSwapEnabled failed.`,
        hash: result.hash,
      });
      throw error;
    }
  };

  const updateWeightsGraduallyHandler = async (
    startTime: Date,
    endTime: Date,
    _endWeights: DecimalBigNumber[],
  ) => {
    const endWeights = _endWeights.map(({ value }) => value);
   
    let result;
    try {
      result = await constractInstance!.updateWeightsGradually(
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
      openNotification({
        title: `updateWeights failed.`,
        hash: result.hash,
      });
      throw error;
    }
  };

  const [swapHandler, swapRequestState] = useRequestState(setSwapEnabledHandler);
  const [updateWeightHandler, updateWeightsRequestState] = useRequestState(updateWeightsGraduallyHandler);

  return {
    setSwapEnabled: {
      handler: swapHandler,
      ...swapRequestState,
    },
    updateWeightsGradually: {
      handler: updateWeightHandler,
      ...updateWeightsRequestState,
    },
  };
};
