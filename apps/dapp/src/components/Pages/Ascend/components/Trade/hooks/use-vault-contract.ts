import { useEffect, useState } from 'react';
import { BigNumber, Contract, utils } from 'ethers';

import balancerVaultAbi from 'data/abis/balancerVault.json';
import { Pool } from 'components/Layouts/Ascend/types';
import { useWallet } from 'providers/WalletProvider';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import useRequestState from 'hooks/use-request-state';
import { ZERO } from 'utils/bigNumber';

export enum JoinType {
  Init = 0,
  Add = 1,
}

export const useVaultContract = (
  pool: undefined | Pool,
  vaultAddress: string
) => {
  const { wallet, signer } = useWallet();
  const [vaultContract, setVaultContract] = useState<Contract>();

  useEffect(() => {
    if (vaultContract || !vaultAddress || !signer) {
      return;
    }

    setVaultContract(
      new Contract(vaultAddress as string, balancerVaultAbi, signer)
    );
  }, [vaultAddress, vaultContract, signer, setVaultContract]);

  // TODO: This is commented out because of the wagmi replacement
  // We can probably remove the file entirely if we don't need it anymore
  // const _poolBalance = useBalance({
  //   address: wallet,
  //   token: pool?.address,
  //   enabled: !!wallet && !!pool?.address,
  // });

  // const poolBalance = _poolBalance?.data?.value || ZERO;
  const poolBalance = ZERO;

  const joinPool = async (
    poolId: string,
    joinType: JoinType,
    assets: string[],
    _maxAmountsIn: DecimalBigNumber[]
  ) => {
    const maxAmountsIn = _maxAmountsIn.map((dbn) => dbn.value);
    return vaultContract!.joinPool(
      poolId,
      wallet,
      wallet,
      {
        assets,
        maxAmountsIn,
        userData: utils.defaultAbiCoder.encode(
          ['uint256', 'uint256[]'],
          [joinType, maxAmountsIn]
        ),
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
    deadline: BigNumber
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

  const getSwapQuote = async (
    amount: DecimalBigNumber,
    sellAssetAddress: string,
    buyAssetAddress: string
  ) => {
    const assetOutIndex = pool!.tokensList.findIndex(
      (address) => address === buyAssetAddress
    );
    const assetInIndex = pool!.tokensList.findIndex(
      (address) => address === sellAssetAddress
    );

    return vaultContract!.callStatic.queryBatchSwap(
      0,
      [
        {
          poolId: pool!.id,
          assetInIndex,
          assetOutIndex,
          amount: amount.value,
          userData: '0x',
        },
      ],
      pool!.tokensList,
      {
        sender: wallet!.toLowerCase(),
        recipient: wallet!.toLowerCase(),
        fromInternalBalance: false,
        toInternalBalance: false,
      },
      {
        gasLimit: 400000,
      }
    );
  };

  const exitPool = async (poolId: string, assets: string[]) => {
    const minAmounts = new Array(assets.length).fill(ZERO);

    return vaultContract!.exitPool(
      poolId,
      wallet,
      wallet,
      {
        assets,
        minAmountsOut: minAmounts,
        userData: utils.defaultAbiCoder.encode(
          ['uint256', 'uint256'],
          [1, poolBalance]
        ), // EXACT_BPT_IN_FOR_TOKENS_OUT
        toInternalBalance: false,
      },
      {
        gasLimit: 400000,
      }
    );
  };

  const [joinPoolRequest, joinPoolRequestState] = useRequestState(joinPool, {
    shouldReThrow: true,
  });
  const [exitPoolRequest, exitPoolRequestState] = useRequestState(exitPool, {
    shouldReThrow: true,
  });
  const [getSwapQuoteRequest, getSwapQuoteRequestState] = useRequestState(
    getSwapQuote,
    { shouldReThrow: true }
  );

  return {
    address: vaultContract?.address || '',
    isReady: !!vaultContract && !!wallet,
    swap,
    joinPool: {
      request: joinPoolRequest,
      ...joinPoolRequestState,
    },
    exitPool: {
      request: exitPoolRequest,
      ...exitPoolRequestState,
    },
    getSwapQuote: {
      request: getSwapQuoteRequest,
      ...getSwapQuoteRequestState,
    },
  };
};
