import { useEffect, useState } from 'react';
import { BigNumber, Contract, utils } from 'ethers';

import balancerVaultAbi from 'data/abis/balancerVault.json';
import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';

export const useVaultContract = (pool: undefined | Pool, vaultAddress: string) => {
  const { wallet, signer } = useWallet();
  const [vaultContract, setVaultContract] = useState<Contract>();
  
  useEffect(() => {
    if (vaultContract || !vaultAddress || !signer) {
      return;
    }

    setVaultContract(new Contract(vaultAddress as string, balancerVaultAbi, signer));
  }, [vaultAddress, vaultContract, signer, setVaultContract]);

  const joinPool = async (
    poolId: string,
    assets: string[],
    _maxAmountsIn: DecimalBigNumber[],
  ) => {
    const maxAmountsIn = _maxAmountsIn.map((dbn) => dbn.value);
    return vaultContract!.joinPool(
      poolId,
      wallet,
      wallet,
      {
        assets,
        maxAmountsIn,
        userData: utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [0, maxAmountsIn]),
        fromInternalBalance: false,
      },
      {
        gasLimit: 400000,
      }
    );
  };

  const swap = async (
    amount: DecimalBigNumber,
    sellAssetAddress: string,
    buyAssetAddress: string,
    limits: BigNumber,
    deadline: BigNumber,
  ) => {
    const swap = {
      kind: 0,
      poolId: pool!.id,
      assetIn: sellAssetAddress,
      assetOut: buyAssetAddress,
      amount: amount.toBN(amount.getDecimals()),
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
  };

  const getSwapQuote = async (amount: BigNumber, sellAssetAddress: string, buyAssetAddress: string) => {
    const assetOutIndex = pool!.tokensList.findIndex((address) => address === buyAssetAddress);
    const assetInIndex = pool!.tokensList.findIndex((address) => address === sellAssetAddress);

    return vaultContract!.callStatic.queryBatchSwap(
      0,
      [{
        poolId: pool!.id,
        assetInIndex,
        assetOutIndex,
        amount: amount,
        userData: '0x',
      }],
      pool!.tokensList,
      {
        sender: wallet!.toLowerCase(),
        recipient: wallet!.toLowerCase(),
        fromInternalBalance: false,
        toInternalBalance: false,
      }, {
        gasLimit: 400000,
      }
    );
  };

  return {
    address: vaultContract?.address || '',
    isReady: !!vaultContract && !!wallet,
    swap, 
    joinPool,
    getSwapQuote,
  };
};