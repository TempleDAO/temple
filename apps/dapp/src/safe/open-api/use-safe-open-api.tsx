import {
  AllTransactionsSchema,
  SafeMultisigTransactionResponse,
  V1Service,
} from './client';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

type SafeApiRes<T> = {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T;
};

export const useSafeTxs = (
  safeWalletAddress: string,
  walletAddress: string | undefined,
  onlyExecuted: boolean,
  orderByNonce: boolean,
  refetchInterval?: number | false
): UseQueryResult<SafeApiRes<SafeMultisigTransactionResponse[]>> =>
  useQuery({
    queryKey: [
      'getSafeTransactions',
      safeWalletAddress,
      walletAddress,
      onlyExecuted,
      refetchInterval,
    ],
    queryFn: () => {
      return V1Service.v1SafesMultisigTransactionsList(
        safeWalletAddress,
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
        onlyExecuted ? 'true' : 'false', // should return executed txs, if false only return queued txs
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        orderByNonce ? 'nonce' : undefined // order asc by nonce, so users see transactions to be executed
      );
    },
    refetchInterval,
  });

export const useSafeAllTransactions = (
  safeWalletAddress: string
): UseQueryResult<SafeApiRes<AllTransactionsSchema>> =>
  useQuery({
    queryKey: ['getAllSafeTransactions', safeWalletAddress],
    queryFn: () => {
      return V1Service.v1SafesAllTransactionsList(safeWalletAddress);
    },
  });

export const useSafeCheckOwner = (
  safeWalletAddress: string,
  ownerAddress: string | undefined
): UseQueryResult<boolean> =>
  useQuery({
    queryKey: ['checkSafeOwner', safeWalletAddress, ownerAddress],
    queryFn: async () => {
      const safeDetails = await V1Service.v1SafesRead(safeWalletAddress);
      return (
        safeDetails.owners.filter(
          (o) => o.toLowerCase() === ownerAddress?.toLowerCase()
        ).length > 0
      );
    },
  });
