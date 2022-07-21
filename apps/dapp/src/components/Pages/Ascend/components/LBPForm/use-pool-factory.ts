import { BigNumber, Contract } from 'ethers';

import liquidityBootstrappingPoolAbi from 'data/abis/liquidityBootstrappingPool.json';

import { useWallet } from 'providers/WalletProvider';
import { useEffect, useState } from 'react';
import { formatEther, parseEther } from 'ethers/lib/utils';

export interface CreatePoolParams {
  name: string;
  symbol: string;
  tokenAddresses: string[];
  weights: BigNumber[];
  feePercentage: number;
  swapEnabledOnStart: boolean;
}

export const useFactoryContract = () => {
  const { signer } = useWallet();

  const [ownerAddress, setOwnerAddress] = useState<string>();

  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const ownerAddress = await signer.getAddress();
      // setOwnerAddress(ownerAddress);
      setOwnerAddress('0xad2da3dc8b6e5a69cb9691f4540d8835a45edfea');
    })();

    return () => {};
  }, [signer]);

  if (!signer) {
    return {
      createPool: async () => {
        throw new Error('Wallet not connected');
      },
    };
  }

  // TODO: Find correct address and ABI
  const lbpFactoryContractAddress = '0xb48Cc42C45d262534e46d5965a9Ac496F1B7a830';
  const lbpFactoryContract: Contract = new Contract(lbpFactoryContractAddress, liquidityBootstrappingPoolAbi, signer);

  return {
    createPool: async (params: CreatePoolParams) => {
      // TODO: Cleanup the interface
      const weight1 = parseEther(params.weights[0].toString());
      const weight2 = parseEther(params.weights[1].toString());

      return lbpFactoryContract!.create(
        params.name,
        params.symbol,
        params.tokenAddresses,
        [weight1, weight2],
        parseEther((params.feePercentage / 100).toString()),
        ownerAddress,
        true,
        {
          gasLimit: 400000,
        }
      );
    },
  };
};
