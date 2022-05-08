import { useEffect } from 'react';
import { Signer } from 'ethers';
import {
  Vault__factory,
  TempleERC20Token__factory,
} from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';

import { fromAtto, toAtto } from 'utils/bigNumber';
import { useNotification } from 'providers/NotificationProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { Nullable } from 'types/util';

const ENV = import.meta.env;

const DEFAULT_ALLOWANCE = toAtto(100000000);

const createTokenFactoryInstance = (ticker: TICKER_SYMBOL, signer: Signer) => {
  switch (ticker) {
    case TICKER_SYMBOL.TEMPLE_TOKEN:
      return new TempleERC20Token__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_ADDRESS);
  }
  throw new Error('Unsupported Token');
};

type HookReturnType = [{ allowance: Nullable<number>, isLoading: boolean }, () => Promise<void>];

export const useTokenVaultAllowance = (
  vaultContractAddress: string,
  ticker: TICKER_SYMBOL = TICKER_SYMBOL.TEMPLE_TOKEN,
): HookReturnType => {
  const { signer, wallet, isConnected } = useWallet();
  const { openNotification } = useNotification();
  
  const getTokenAllowance = async () => {
    if (!signer || !wallet) {
      console.error(`Programming Error: Missing signer or wallet address when trying to get token allowance.`);
      return;
    }

    const token = createTokenFactoryInstance(ticker, signer);
    const vault = new Vault__factory(signer).attach(vaultContractAddress);
    const allowance = await token.allowance(wallet, vault.address);
    return allowance;
  };
  
  const [
    getAllowanceRequest,
    {
      isLoading: getAllowanceLoading,
      response: allowance,
    },
  ] = useRequestState(getTokenAllowance);

  const increaseAllowance = async () => {
    if (!signer || !wallet) {
      console.error(`Programming Error: Missing signer or wallet address when trying to increase allowance.`);
      return;
    }

    const token = createTokenFactoryInstance(ticker, signer);
    const approveTXN = await token.approve(vaultContractAddress, DEFAULT_ALLOWANCE);
    await approveTXN.wait();
  
    openNotification({
      title: `${ticker} allowance approved`,
      hash: approveTXN.hash,
    });

    await getAllowanceRequest();
  };

  const [
    increaseAllowanceRequest, 
    { 
      isLoading: increaseAllowanceLoading,
    },
  ] = useRequestState(increaseAllowance);

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    
    getAllowanceRequest();
  }, [
    isConnected,
    vaultContractAddress,
    getAllowanceRequest,
    ticker,
  ]);

  return [
    {
      allowance: !allowance ? null : fromAtto(allowance),
      isLoading: getAllowanceLoading || increaseAllowanceLoading,
    },
    increaseAllowanceRequest
  ];
};
