import { Contract } from 'ethers';

import liquidityBootstrappingPoolAbi from 'data/abis/liquidityBootstrappingPool.json';

import { useWallet } from 'providers/WalletProvider';
import { useEffect, useState } from 'react';
import { parseEther } from 'ethers/lib/utils';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { useNotification } from 'providers/NotificationProvider';

export interface CreatePoolParams {
  name: string;
  symbol: string;
  tokenAddresses: string[];
  weights: DecimalBigNumber[];
  feePercentage: number;
  swapEnabledOnStart: boolean;
}

// TODO: Move to env
const LBP_FACTORY_CONTRACT_ADDRESS = '0xb48Cc42C45d262534e46d5965a9Ac496F1B7a830';

export const useFactoryContract = () => {
  const { signer, wallet } = useWallet();
  const [contractInstance, setContractInstance] = useState<Contract>();
  const { openNotification } = useNotification();
  const [isCreatePoolLoading, setIsCreatePoolLoading] = useState(false);
  const [createPoolError, setCreatePoolError] = useState<null | string>(null);

  useEffect(() => {
    if (!signer || contractInstance) {
      return;
    }
    
    setContractInstance(new Contract(LBP_FACTORY_CONTRACT_ADDRESS, liquidityBootstrappingPoolAbi, signer))
  }, [signer, contractInstance, setContractInstance]);

  if (!signer) {
    return {
      createPool: {
        handler: async () => {
          throw new Error('Wallet not connected');
        },
        isLoading: false,
        error: null,
      },
    };
  }
  
  const createPoolHandler = async (params: CreatePoolParams) => {
    let result;
    try {
      setIsCreatePoolLoading(true);
      result = await contractInstance!.create(
        params.name,
        params.symbol,
        params.tokenAddresses,
        [params.weights[0].value, params.weights[1].value],
        parseEther((params.feePercentage / 100).toString()),
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
    } finally {
      setIsCreatePoolLoading(false);
    }
  };

  return {
    createPool: {
      handler: createPoolHandler,
      isLoading: isCreatePoolLoading,
      error: createPoolError,
    },
  };
};
