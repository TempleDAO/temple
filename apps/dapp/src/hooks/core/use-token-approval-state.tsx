import {
  Vault__factory,
  TempleERC20Token__factory,
} from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';

import { fromAtto, toAtto } from 'utils/bigNumber';
import { useEffect } from 'react';
import { BigNumber } from 'ethers';
import { useNotification } from 'providers/NotificationProvider';

const ENV = import.meta.env;

const DEFAULT_ALLOWANCE = toAtto(100000000);

export const useHasVaultAllowance = (vaultContractAddress: string): [{ allowance: null | number, isLoading: boolean }, () => Promise<void>] => {
  const { signer, wallet, isConnected } = useWallet();
  const { openNotification } = useNotification();
  const skip = !signer || !wallet; 
  
  const getTokenAllowance = async () => {
    if (!signer || !wallet) {
      console.error(`Programming Error: Missing signer or wallet address when trying to get token allowance.`);
      return;
    }

    const temple = new TempleERC20Token__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_ADDRESS);
    const vault = new Vault__factory(signer).attach(vaultContractAddress);
    const allowance = await temple.allowance(wallet, vault.address);
    return allowance;
  };
  
  const [
    getAllowanceRequest,
    {
      isLoading: getAllowanceLoading,
      error: getAllowanceError,
      response: allowance 
    },
  ] = useRequestState(getTokenAllowance);

  const increaseAllowance = async () => {
    if (!signer || !wallet) {
      console.error(`Programming Error: Missing signer or wallet address when trying to increase allowance.`);
      return;
    }

    const temple = new TempleERC20Token__factory(signer).attach(ENV.VITE_PUBLIC_TEMPLE_ADDRESS);
    const approveTXN = await temple.approve(vaultContractAddress, DEFAULT_ALLOWANCE);
    await approveTXN.wait();
  
    openNotification({
      title: `Allowance approved`,
      hash: approveTXN.hash,
    });

    await getAllowanceRequest();
  };

  const [
    increaseAllowanceRequest, 
    { 
      isLoading: increaseAllowanceLoading,
      error: allowanceError,
      response
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
  ]);

  return [
    {
      allowance: !allowance ? null : fromAtto(allowance),
      isLoading: getAllowanceLoading,
    },
    increaseAllowanceRequest
  ];
};
