import { useEffect, useState } from 'react';
import { BigNumber, Contract, utils } from 'ethers';
import { useWallet } from 'providers/WalletProvider';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import useRequestState from 'hooks/use-request-state';
// TODO: Replace with correct ABI
import placehodlerAbi from 'data/abis/balancerVault.json';

export type ZapSuccessCallback = () => Promise<void>;

export const useAscendZapContract = (onSuccess?: ZapSuccessCallback) => {
  const { wallet, signer } = useWallet();
  const zapContractAddress = '0x1234';
  const [zapContract, setZapContract] = useState<Contract>();

  useEffect(() => {
    if (!signer) {
      return;
    }

    setZapContract(new Contract(zapContractAddress, placehodlerAbi, signer));
  }, [zapContract, signer, setZapContract]);

  const swap = async (
    amount: DecimalBigNumber,
    sellAssetAddress: string,
    buyAssetAddress: string,
    limits: BigNumber,
    deadline: BigNumber
  ) => {
    // TODO: Get the corret txn params
    const swap = {
      kind: 0,
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

    return zapContract!.swap(swap, funds, limits, deadline, {
      gasLimit: 400000,
    });
  };

  const [request, state] = useRequestState(swap, { shouldReThrow: true });

  return {
    address: zapContract?.address || '',
    isReady: !!zapContract && !!wallet,
    swap: {
      request,
      ...state,
    },
  };
};
