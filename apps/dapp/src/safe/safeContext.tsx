import { PropsWithChildren, createContext, useContext } from 'react';
import { SafeMultisigTransactionResponse } from './open-api/client';
import { useSafeCheckOwner, useSafeTxs } from './open-api/use-safe-open-api';
import { SafeStatus, SafeTableRow } from 'components/Pages/Safe/admin/SafeTxDataTable';
import { useWallet } from 'providers/WalletProvider';
import { format } from 'date-fns';
import { useSafeSdk } from './sdk/use-safe-sdk';

interface ISafeTransactionsContext {
  isLoading: () => boolean;
  tableRows: (updateSafeTableRow: (safeTxHash: string, newValue?: SafeTableRow) => void) => SafeTableRow[];
}
const SafeTransactionsContext = createContext<ISafeTransactionsContext | undefined>(undefined);

type SafeTransactionsContextProviderProps = {
  safeAddress: string;
};
export function SafeTransactionsContextProvider({
  children,
  safeAddress,
}: PropsWithChildren<SafeTransactionsContextProviderProps>) {
  const safeTableRows: SafeTableRow[] = [];
  const { walletAddress, signer } = useWallet();
  const { data: isSafeOwner } = useSafeCheckOwner(safeAddress, walletAddress);
  const { signSafeTx, executeSafeTx } = useSafeSdk(signer, safeAddress);

  const safePendingTransactions = useSafeTxs(safeAddress, false, true, 5000);
  const safeExecutedTransactions = useSafeTxs(safeAddress, true, false, 5000);

  const getAllTransactions = () => {
    const safeTransactions: SafeMultisigTransactionResponse[] = [];
    safeTransactions.push(...(safePendingTransactions.data?.results ?? []));
    safeTransactions.push(...(safeExecutedTransactions.data?.results ?? []));
    return safeTransactions;
  };

  const isLoading = () => {
    return safePendingTransactions.isLoading || safeExecutedTransactions.isLoading;
  };

  const tableRows = (updateSafeTableRow: (safeTxHash: string, newValue?: SafeTableRow) => void) => {
    getAllTransactions().map(async (tx) => {
      const txConfirmations = tx.confirmations ?? [];
      const thresholdReached = txConfirmations.length >= tx.confirmationsRequired;
      const alreadySigned =
        txConfirmations.filter((conf) => conf.owner.toLowerCase() === walletAddress?.toLowerCase()).length > 0;
      let status: SafeStatus = thresholdReached ? 'awaiting_execution' : 'awaiting_signing';
      if (tx.isSuccessful && tx.isExecuted) {
        status = 'successful';
      } else if (!tx.isSuccessful && tx.isExecuted) {
        status = 'error';
      }
      safeTableRows.push({
        date: format(new Date(tx.submissionDate), 'yyyy-MM-dd H:mm:ss O'),
        txHash: tx.safeTxHash,
        status,
        confirmations: `${txConfirmations.length}/${tx.confirmationsRequired}`,
        alreadySigned: alreadySigned,
        type: tx.dataDecoded?.method ?? (tx.value.length > 1 ? 'transfer' : undefined),
        isOwner: isSafeOwner ?? false,
        nonce: tx.nonce,
        action: async () => {
          const prevSafeTableRow = safeTableRows.find((str) => str.txHash === tx.safeTxHash);
          try {
            if (!prevSafeTableRow) throw 'prevSafeTableRow undefined';
            switch (status) {
              case 'awaiting_signing':
                await signSafeTx(tx.safeTxHash);
                updateSafeTableRow(prevSafeTableRow.txHash, { ...prevSafeTableRow, status: 'loading' });
                return;
              case 'awaiting_execution':
                await executeSafeTx(tx.safeTxHash);
                updateSafeTableRow(prevSafeTableRow.txHash, { ...prevSafeTableRow, status: 'loading' });
                return;
            }
          } catch (e) {
            if (!prevSafeTableRow) throw 'prevSafeTableRow undefined';
            updateSafeTableRow(prevSafeTableRow.txHash, { ...prevSafeTableRow, status: 'error' });
          }
        },
      });
    });
    return safeTableRows;
  };

  const context: ISafeTransactionsContext = {
    tableRows,
    isLoading,
  };

  return <SafeTransactionsContext.Provider value={context}>{children}</SafeTransactionsContext.Provider>;
}

export const useSafeTransactions = () => {
  const context = useContext(SafeTransactionsContext);

  if (context === undefined) {
    throw new Error('useSafeTransactions must be used within SafeTransactionsContext');
  }

  return context;
};
