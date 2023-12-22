import { Address } from '@web3-onboard/core/dist/types';
import { AllTransactionsSchema, SafeMultisigTransactionResponse, V1Service } from './client';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { SafeStatus, SafeTableRow } from 'components/Pages/Safe/admin/SafeTxDataTable';
import { useWallet } from 'providers/WalletProvider';
import { format } from 'date-fns';
import { useSafeSdk } from 'hooks/use-safe-sdk';

type SafeApiRes<T> = {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T;
};

export const useSafePendingTxs = (safeWallet: Address): UseQueryResult<SafeApiRes<SafeMultisigTransactionResponse[]>> =>
  useQuery({
    queryKey: ['getPendingSafeTransactions', safeWallet],
    queryFn: () => {
      return V1Service.v1SafesMultisigTransactionsList(
        safeWallet,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'false', // should return executed txs, if false only return queued txs
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'nonce' // order asc by nonce, so users see transactions to be executed
      );
    },
    refetchInterval: 5000
  });

export const useSafeAllTransactions = (safeWallet: Address): UseQueryResult<SafeApiRes<AllTransactionsSchema>> =>
  useQuery({
    queryKey: ['getAllSafeTransactions', safeWallet],
    queryFn: () => {
      return V1Service.v1SafesAllTransactionsList(safeWallet);
    },
  });

export const useSafeCheckOwner = (safeWallet: Address, ownerAddress: Address | undefined): UseQueryResult<boolean> =>
  useQuery({
    queryKey: ['checkSafeOwner', safeWallet],
    queryFn: async () => {
      const safeDetails = await V1Service.v1SafesRead(safeWallet);
      return safeDetails.owners.filter((o) => o.toLowerCase() === ownerAddress?.toLowerCase()).length > 0;
    },
  });

export const useSafeDataSubset = (
  safePendingTxsApi: UseQueryResult<SafeApiRes<SafeMultisigTransactionResponse[]>>, 
  isOwner: boolean,
  safeAddress: string,
) => {
  const { walletAddress, signer } = useWallet();
  const { signSafeTx, executeSafeTx} = useSafeSdk(signer, safeAddress);
  return useQuery({
    queryKey: ['getSafeDataSubset', walletAddress, safePendingTxsApi, isOwner],
    queryFn: () => {
      const res: Array<SafeTableRow> = [];
      safePendingTxsApi.data?.results.map(async (tx) => {
        const txConfirmations = tx.confirmations ?? [];
        const thresholdReached = txConfirmations.length >= tx.confirmationsRequired;
        const alreadySigned =
          txConfirmations.filter((conf) => conf.owner.toLowerCase() === walletAddress?.toLowerCase()).length > 0;
        const status: SafeStatus = thresholdReached ? 'awaiting_execution' : 'awaiting_signing';

        res.push({
          date: format(new Date(tx.submissionDate), 'yyyy-MM-dd H:mm:ss O'),
          txHash: tx.safeTxHash,
          status,
          confirmations: `${txConfirmations.length}/${tx.confirmationsRequired}`,
          alreadySigned: alreadySigned,
          isOwner,
          nonce: tx.nonce,
          action: async () => {
            switch (status) {
              case 'awaiting_signing':
                try {
                  await signSafeTx(tx.safeTxHash);
                } catch (e) {}
                return;
              case 'awaiting_execution':
                try {
                  const resExec = await executeSafeTx(tx.safeTxHash);
                  console.log('resExec', resExec);
                } catch (e) {}
                return;
            }
          },
        });
      });
      return res;
    },
  });
};
