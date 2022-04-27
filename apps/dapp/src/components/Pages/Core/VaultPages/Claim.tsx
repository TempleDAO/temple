import { useState, useEffect } from 'react';
import styled from 'styled-components';

import { VaultInput } from 'components/Input/VaultInput';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberWithCommas } from 'utils/formatter';
import { copyBalance } from 'components/AMM/helpers/methods';
import { Header } from 'styles/vault';
import VaultContent, {
  VaultButton,
} from 'components/Pages/Core/VaultPages/VaultContent';
import { useWithdrawFromVault } from 'hooks/core/use-withdraw-from-vault';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useGetCoreVaultUserDeposits } from 'hooks/core/subgraph';
import Loader from 'components/Loader/Loader';
import useVaultContext from './useVaultContext';
import { Nullable } from 'types/util';

export const Claim = () => {
  const vault = useVaultContext();
  const { isLoading: balancesLoading, vaultUserBalances } = useGetCoreVaultUserDeposits(vault.id);
  const [{ isLoading: refreshLoading }, refreshWalletState] = useRefreshWalletState();
  const [{ loading: withdrawIsLoading, error }, withdraw] = useWithdrawFromVault(vault.id, async () => {
    await refreshWalletState();
  });

  const claimableAmount = vaultUserBalances?.[0]?.amount || 0;
 
  const [vaultBalance, setVaultBalance] = useState<Nullable<number>>(null);
  useEffect(() => {
    if (vaultBalance !== null || balancesLoading) {
      return;
    }
    setVaultBalance(Number(claimableAmount));
  }, [vaultBalance, setVaultBalance, balancesLoading, claimableAmount]);
  
  
  const [amount, setAmount] = useState(0);

  const buttonIsDisabled = (
    refreshLoading ||
    withdrawIsLoading ||
    !amount || 
    amount > (vaultBalance || 0)
  );

  let claimLabel = null;
  if (vaultBalance !== null) {
    claimLabel = vaultBalance > 0 ? (
      <ClaimableLabel>
        Claimable Temple
          <TempleAmountLink
            onClick={() => copyBalance(vaultBalance, setAmount)}
          >
            {formatNumberWithCommas(vaultBalance)}
          </TempleAmountLink>
      </ClaimableLabel>
    ) : (
      <ClaimableLabel>
        Nothing to claim
        <TempleAmountLink>
          &nbsp; {/* Note: this node is here for formatting/spacing */}
        </TempleAmountLink>
      </ClaimableLabel>
    );
  }

  return (
    <VaultContent>
      <Header>Claim</Header>
      {claimLabel}
      <VaultInput
        tickerSymbol={TICKER_SYMBOL.TEMPLE_TOKEN}
        handleChange={(value: number) => {
          setAmount(value || 0);
        }}
        isNumber
        placeholder="0.00"
        value={amount}
      />
      {!!error && (
        <ErrorLabel>{error.message || 'Something went wrong'}</ErrorLabel>
      )}
      <VaultButton
        label={'claim'}
        autoWidth
        marginTop={error ? '0.5rem' : '3.5rem'}
        disabled={buttonIsDisabled}
        onClick={async () => {
          await withdraw(amount);
          setVaultBalance((balance) => {
            if (!balance) {
              return balance;
            }
            return balance - amount;
          });
          setAmount(0);
        }}
      />
    </VaultContent>
  );
};

const ClaimableLabel = styled.div`
  color: #9e6844;
  font-size: 1.5rem;
  margin-top: 1.25rem;
  margin-bottom: 1.25rem;
`;

const ErrorLabel = styled.span`
  color: ${({ theme }) => theme.palette.enclave.chaos};
  display: block;
  margin: 1rem 0;
`;

const TempleAmountLink = styled.a`
  display: block;
  cursor: pointer;
  font-size: 2.2rem;
  color: #d9bdab;
  padding-top: 0.625rem;
`;
