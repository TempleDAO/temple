import { useEffect } from 'react';
import { Signer } from 'ethers';
import { ERC20__factory } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import useRequestState from 'hooks/use-request-state';

import { fromAtto, toAtto } from 'utils/bigNumber';
import { useNotification } from 'providers/NotificationProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { Nullable } from 'types/util';

const DEFAULT_ALLOWANCE = toAtto(100000000);

export const createTokenFactoryInstance = async (
  ticker: TICKER_SYMBOL | string,
  signer: Signer
) => {
  return new ERC20__factory(signer).attach(ticker);
};

type HookReturnType = [
  { allowance: Nullable<number>; isLoading: boolean },
  () => Promise<void>
];

export const useTokenContractAllowance = (
  tokenInfo: { address: string; name: string; ticker?: string },
  contractAddress = ''
): HookReturnType => {
  const { signer, wallet, isConnected } = useWallet();
  const { openNotification } = useNotification();

  const getTokenAllowance = async () => {
    if (!signer || !wallet) {
      console.error(
        `Programming Error: Missing signer or wallet address when trying to get token allowance.`
      );
      return;
    }

    const token = new ERC20__factory(signer).attach(tokenInfo.address);
    const allowance = await token.allowance(wallet, contractAddress);
    return allowance;
  };

  const [
    getAllowanceRequest,
    { isLoading: getAllowanceLoading, response: allowance },
  ] = useRequestState(getTokenAllowance);

  const increaseAllowance = async () => {
    if (!signer || !wallet) {
      console.error(
        `Programming Error: Missing signer or wallet address when trying to increase allowance.`
      );
      return;
    }

    const token = new ERC20__factory(signer).attach(tokenInfo.address);
    const approveTXN = await token.approve(contractAddress, DEFAULT_ALLOWANCE, {
      gasLimit: 50000,
    });
    await approveTXN.wait();

    openNotification({
      title: `${tokenInfo.name} allowance approved`,
      hash: approveTXN.hash,
    });

    await getAllowanceRequest();
  };

  const [increaseAllowanceRequest, { isLoading: increaseAllowanceLoading }] =
    useRequestState(increaseAllowance);

  useEffect(() => {
    if (!isConnected || !contractAddress) {
      return;
    }

    getAllowanceRequest();
  }, [isConnected, getAllowanceRequest, tokenInfo.address, contractAddress]);

  return [
    {
      allowance: !allowance ? null : fromAtto(allowance),
      isLoading: getAllowanceLoading || increaseAllowanceLoading,
    },
    increaseAllowanceRequest,
  ];
};
