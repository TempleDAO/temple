import { useEffect, useState } from 'react';
import { BigNumber, Contract } from 'ethers';
import { useContractReads } from 'wagmi';

import balancerPoolAbi from 'data/abis/balancerPool.json';
import balancerVaultAbi from 'data/abis/balancerVault.json';
import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';

export const useVaultContract = (pool: Pool) => {
  const { wallet, signer } = useWallet();
  const [vaultContract, setVaultContract] = useState<Contract>();

  const { data } = useContractReads({
    contracts: [{
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getVault',
    }],
  });

  useEffect(() => {
    if (vaultContract || !data || !signer) {
      return;
    }

    const vaultAddress = !!data && data.length > 0 ? data[0] : '';
    setVaultContract(new Contract(vaultAddress as string, balancerVaultAbi, signer));
  }, [data, vaultContract, signer, setVaultContract]);

  return {
    address: vaultContract?.address || '',
    isReady: !!vaultContract && !!wallet,
    async getSwapQuote(amount: BigNumber, sellAssetAddress: string, buyAssetAddress: string) {
      const assetOutIndex = pool.tokensList.findIndex((address) => address === buyAssetAddress);
      const assetInIndex = pool.tokensList.findIndex((address) => address === sellAssetAddress);

      return vaultContract!.callStatic.queryBatchSwap(
        0,
        [{
          poolId: pool.id,
          assetInIndex,
          assetOutIndex,
          amount,
          userData: '0x',
        }],
        pool.tokensList,
        {
          sender: wallet!.toLowerCase(),
          recipient: wallet!.toLowerCase(),
          fromInternalBalance: false,
          toInternalBalance: false,
        },
      );
    },
    async swap(
      amount: BigNumber,
      sellAssetAddress: string,
      buyAssetAddress: string,
      limits: BigNumber,
      deadline: BigNumber,
    ) {
      const swap = {
        poolId: pool.id,
        kind: 0,
        assetIn: sellAssetAddress,
        assetOut: buyAssetAddress,
        amount,
        userData: '0x',
      };
      
      const funds = {
        sender: wallet!.toLowerCase(),
        recipient: wallet!.toLowerCase(),
        fromInternalBalance: false,
        toInternalBalance: false,
      };

      return vaultContract!.swap(swap, funds, limits, deadline, {
        gasLimit: 400000,
      });
    },
  };
};