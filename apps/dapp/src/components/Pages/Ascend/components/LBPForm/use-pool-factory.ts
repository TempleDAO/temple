import { Contract } from 'ethers';

import liquidityBootstrappingPoolAbi from 'data/abis/liquidityBootstrappingPool.json';

import { useWallet } from 'providers/WalletProvider';
import { useEffect, useState } from 'react';
import { parseEther } from 'ethers/lib/utils';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { useNotification } from 'providers/NotificationProvider';
import useRequestState from 'hooks/use-request-state';
import env from 'constants/env';

export interface CreatePoolParams {
  name: string;
  symbol: string;
  tokenAddresses: string[];
  weights: DecimalBigNumber[];
  feePercentage: number;
  swapEnabledOnStart: boolean;
}

const LBP_FACTORY_CONTRACT_ADDRESS = env.contracts.lbpFactory;

export const useFactoryContract = () => {
  const { signer, wallet } = useWallet();
  const [contractInstance, setContractInstance] = useState<Contract>();
  const { openNotification } = useNotification();

  useEffect(() => {
    if (!signer || contractInstance) {
      return;
    }

    setContractInstance(
      new Contract(
        LBP_FACTORY_CONTRACT_ADDRESS,
        liquidityBootstrappingPoolAbi,
        signer
      )
    );
  }, [signer, contractInstance, setContractInstance]);

  const createPool = async (params: CreatePoolParams) => {
    let result;
    try {
      const swapFeePercentage = parseEther(
        (params.feePercentage / 100).toString()
      );

      result = await contractInstance!.create(
        params.name,
        params.symbol,
        params.tokenAddresses,
        [params.weights[0].value, params.weights[1].value],
        swapFeePercentage,
        wallet,
        true,
        {
          gasLimit: 5000000,
        }
      );

      await result.wait();

      openNotification({
        title: `Pool created successfully.`,
        hash: result.hash,
      });
    } catch (error: any) {
      console.error(error);
      openNotification({
        title: `Pool creation failed.`,
        hash: result.hash,
      });
    }
  };

  const [createPoolHandler, createPoolRequestState] = useRequestState(
    createPool,
    { shouldReThrow: true }
  );

  return {
    createPool: {
      handler: createPoolHandler,
      ...createPoolRequestState,
    },
  };
};
