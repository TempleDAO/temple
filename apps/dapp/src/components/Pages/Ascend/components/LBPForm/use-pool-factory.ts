import { Contract } from 'ethers';

import liquidityBootstrappingPoolAbi from 'data/abis/liquidityBootstrappingPool.json';

import { useWallet } from 'providers/WalletProvider';
import { useState } from 'react';
import { parseEther } from 'ethers/lib/utils';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';

export interface CreatePoolParams {
  name: string;
  symbol: string;
  tokenAddresses: string[];
  weights: DecimalBigNumber[];
  feePercentage: number;
  swapEnabledOnStart: boolean;
}

export const useFactoryContract = () => {
  const { signer, wallet } = useWallet();

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

  const [isCreatePoolLoading, setIsCreatePoolLoading] = useState(false);
  const [createPoolError, setCreatePoolError] = useState<null | string>(null);

  // TODO: Move to env var
  const lbpFactoryContractAddress = '0xb48Cc42C45d262534e46d5965a9Ac496F1B7a830';
  const lbpFactoryContract: Contract = new Contract(lbpFactoryContractAddress, liquidityBootstrappingPoolAbi, signer);

  const createPoolHandler = async (params: CreatePoolParams) => {
    try {
      setIsCreatePoolLoading(true);
      setCreatePoolError(null);
      const result = await lbpFactoryContract!.create(
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
    } catch (error: any) {
      console.error(error);
      setCreatePoolError('Transaction failed.');
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
