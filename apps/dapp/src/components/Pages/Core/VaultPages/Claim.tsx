import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { BigNumber } from 'ethers';

import { VaultInput } from 'components/Input/VaultInput';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { Header } from 'styles/vault';
import VaultContent, { VaultButton } from 'components/Pages/Core/VaultPages/VaultContent';
import { useWithdrawFromVault } from 'hooks/core/use-withdraw-from-vault';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { useVaultBalance } from 'hooks/core/use-vault-balance';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
import { formatNumber } from 'utils/formatter';

export const Claim = () => {
  const { activeVault: vault } = useVaultContext();

  const [amount, setAmount] = useState<string>('');
  const [{ balance, isLoading: getBalanceLoading }, getBalance] = useVaultBalance(vault.id);
  const [{ isLoading: refreshLoading }, refreshWalletState] = useRefreshWalletState();
  const [withdraw, { isLoading: withdrawIsLoading, error }] = useWithdrawFromVault(vault!.id, async () => {
    await refreshWalletState();
    await getBalance();
    setAmount('');
  });

  const handleUpdateAmount = (amount: string) => {
    setAmount(Number(amount) === 0 ? '' : amount);
  };

  const bigInputValue = getBigNumberFromString(amount);
  const formattedBalance = formatBigNumber(balance);

  const buttonIsDisabled =
    getBalanceLoading || refreshLoading || withdrawIsLoading || !amount || bigInputValue.gt(balance);

  const claimLabel = balance.gt(ZERO) ? (
    <ClaimableLabel>
      Claimable {TICKER_SYMBOL.TEMPLE_TOKEN}
      <TempleAmountLink
        onClick={() => {
          handleUpdateAmount(formattedBalance);
        }}
      >
        {formatNumber(formattedBalance)}
      </TempleAmountLink>
    </ClaimableLabel>
  ) : (
    <ClaimableLabel>
      Nothing to claim
      <TempleAmountLink>&nbsp; {/* Note: this node is here for formatting/spacing */}</TempleAmountLink>
    </ClaimableLabel>
  );

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  return (
    <VaultContent>
      <Header>Claim</Header>
      {claimLabel}
      <VaultInput
        tickerSymbol={TICKER_SYMBOL.TEMPLE_TOKEN}
        handleChange={(value) => handleUpdateAmount(value.toString())}
        isNumber
        placeholder="0.00"
        value={amount}
        disabled={balance.lte(ZERO)}
      />
      {!!error && <ErrorLabel>{error.message || 'Something went wrong'}</ErrorLabel>}
      <VaultButton
        label="Claim"
        autoWidth
        marginTop={error ? '0.5rem' : '3.5rem'}
        disabled={buttonIsDisabled}
        onClick={async () => {
          await withdraw(amount);
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
