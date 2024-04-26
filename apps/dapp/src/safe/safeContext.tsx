import { PropsWithChildren, createContext, useContext } from 'react';
import { useSafeCheckOwner, useSafeTxs } from './open-api/use-safe-open-api';
import { SafeTableRow } from 'components/Pages/Safe/admin/SafeTxDataTable';
import { useWallet } from 'providers/WalletProvider';
import { format } from 'date-fns';
import { useSafeSdk } from './sdk/use-safe-sdk';

export type SafeTransactionCategory = 'queue' | 'history';
type SafeTransactionCategoryAction = 'return' | 'add' | 'clear';
export type SafeStatus =
  | 'unknown'
  | 'awaiting_signing'
  | 'awaiting_execution'
  | 'loading'
  | 'successful'
  | 'error';
interface ISafeTransactionsContext {
  safeAddress: string;
  isLoading: () => boolean;
  tableRows: (
    safeTxCategory: SafeTransactionCategory,
    updateSafeTableRow: (safeTxHash: string, newValue?: SafeTableRow) => void
  ) => Promise<SafeTableRow[]>;
}
const SafeTransactionsContext = createContext<
  ISafeTransactionsContext | undefined
>(undefined);

type SafeTransactionsContextProviderProps = {
  safeAddress: string;
};
export function SafeTransactionsContextProvider({
  children,
  safeAddress,
}: PropsWithChildren<SafeTransactionsContextProviderProps>) {
  const safeQueuedTableRows: SafeTableRow[] = [];
  const safeHistoryTableRows: SafeTableRow[] = [];
  const { walletAddress, signer } = useWallet();
  const { data: isSafeOwner } = useSafeCheckOwner(safeAddress, walletAddress);
  const { signSafeTx, executeSafeTx } = useSafeSdk(signer, safeAddress);

  const safeQueuedTransactions = useSafeTxs(
    safeAddress,
    walletAddress,
    false,
    true,
    5000
  );
  const safeExecutedTransactions = useSafeTxs(
    safeAddress,
    walletAddress,
    true,
    false,
    5000
  );

  const getQueuedTransactions = (safeTxCategory: SafeTransactionCategory) => {
    if (safeTxCategory === 'queue')
      return safeQueuedTransactions.data?.results ?? [];
    if (safeTxCategory === 'history')
      return safeExecutedTransactions.data?.results ?? [];
  };

  const getprevSafeTableRow = (
    safeTxCategory: SafeTransactionCategory,
    safeTransactionHash: string
  ) => {
    switch (safeTxCategory) {
      case 'queue':
        return safeQueuedTableRows.find(
          (str) => str.safeTxHash === safeTransactionHash
        );
      case 'history':
        return safeHistoryTableRows.find(
          (str) => str.safeTxHash === safeTransactionHash
        );
    }
  };

  const isLoading = () => {
    return (
      safeQueuedTransactions.isLoading || safeExecutedTransactions.isLoading
    );
  };

  const tableRows = async (
    safeTxCategory: SafeTransactionCategory,
    updateSafeTableRow: (safeTxHash: string, newValue?: SafeTableRow) => void
  ) => {
    safeTxCategoryAction('clear', safeTxCategory);
    await getQueuedTransactions(safeTxCategory)?.map(async (tx) => {
      const txConfirmations = tx.confirmations ?? [];
      const thresholdReached =
        txConfirmations.length >= tx.confirmationsRequired;
      const alreadySigned =
        txConfirmations.filter(
          (conf) => conf.owner.toLowerCase() === walletAddress?.toLowerCase()
        ).length > 0;
      const isOwner = isSafeOwner ?? false;
      let status: SafeStatus = thresholdReached
        ? 'awaiting_execution'
        : 'awaiting_signing';
      if (tx.isSuccessful && tx.isExecuted) {
        status = 'successful';
      } else if (!tx.isSuccessful && tx.isExecuted) {
        status = 'error';
      }
      let rowButtonLabel = 'N/A';
      let rowButtonDisabled = true;
      switch (status) {
        case 'awaiting_signing':
          rowButtonLabel = 'SIGN';
          rowButtonDisabled = !walletAddress || alreadySigned || !isOwner;
          break;
        case 'awaiting_execution':
          rowButtonLabel = 'EXECUTE';
          rowButtonDisabled = !walletAddress && !isOwner;
          break;
      }

      const tmpSafeRow: SafeTableRow = {
        date: format(new Date(tx.submissionDate), 'yyyy-MM-dd H:mm'),
        txHash: tx.transactionHash,
        safeTxHash: tx.safeTxHash,
        status,
        button: {
          label: rowButtonLabel,
          disabled: rowButtonDisabled,
        },
        confirmations: `${txConfirmations.length}/${tx.confirmationsRequired}`,
        alreadySigned,
        type:
          tx.dataDecoded?.method ??
          (tx.value.length > 1 ? 'transfer' : undefined),
        isOwner,
        nonce: tx.nonce,
        isExpanded: false,
        dataRaw: tx.data,
        dataDecode: JSON.stringify(tx.dataDecoded, null, 2),
        action: async () => {
          const prevSafeTableRow = getprevSafeTableRow(
            safeTxCategory,
            tx.safeTxHash
          );
          try {
            if (!prevSafeTableRow) throw 'prevSafeTableRow undefined';
            switch (status) {
              case 'awaiting_signing':
                await signSafeTx(tx.safeTxHash);
                updateSafeTableRow(prevSafeTableRow.safeTxHash, {
                  ...prevSafeTableRow,
                  status: 'loading',
                });
                return;
              case 'awaiting_execution':
                await executeSafeTx(tx.safeTxHash);
                updateSafeTableRow(prevSafeTableRow.safeTxHash, {
                  ...prevSafeTableRow,
                  status: 'loading',
                });
                return;
            }
          } catch (e) {
            if (!prevSafeTableRow) throw 'prevSafeTableRow undefined';
            updateSafeTableRow(prevSafeTableRow.safeTxHash, {
              ...prevSafeTableRow,
              status: 'error',
            });
          }
        },
      };
      return safeTxCategoryAction('add', safeTxCategory, tmpSafeRow);
    });
    return safeTxCategoryAction('return', safeTxCategory) ?? [];
  };

  const safeTxCategoryAction = (
    safeTxCategoryAction: SafeTransactionCategoryAction,
    safeTxCategory: SafeTransactionCategory,
    selectedSafeRow?: SafeTableRow
  ) => {
    switch (safeTxCategoryAction) {
      case 'return':
        if (safeTxCategory === 'queue') return safeQueuedTableRows;
        if (safeTxCategory === 'history') return safeHistoryTableRows;
        break;
      case 'add':
        if (safeTxCategory === 'queue')
          selectedSafeRow && safeQueuedTableRows.push(selectedSafeRow);
        if (safeTxCategory === 'history')
          selectedSafeRow && safeHistoryTableRows.push(selectedSafeRow);
        break;
      case 'clear':
        if (safeTxCategory === 'queue')
          safeQueuedTableRows.splice(0, safeQueuedTableRows.length);
        if (safeTxCategory === 'history')
          safeHistoryTableRows.splice(0, safeHistoryTableRows.length);
        break;
    }
  };

  const context: ISafeTransactionsContext = {
    safeAddress,
    tableRows,
    isLoading,
  };

  return (
    <SafeTransactionsContext.Provider value={context}>
      {children}
    </SafeTransactionsContext.Provider>
  );
}

export const useSafeTransactions = () => {
  const context = useContext(SafeTransactionsContext);

  if (context === undefined) {
    throw new Error(
      'useSafeTransactions must be used within SafeTransactionsContext'
    );
  }

  return context;
};
