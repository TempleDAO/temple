import { useState, useEffect } from 'react';
import styled from 'styled-components';

import { VaultInput } from 'components/Input/VaultInput';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { Header } from 'styles/vault';
import VaultContent, { VaultButton } from 'components/Pages/Core/VaultPages/VaultContent';
import { useWithdrawFromVault } from 'hooks/core/use-withdraw-from-vault';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { useVaultBalance } from 'hooks/core/use-vault-balance';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString, formatBigNumber, formatTemple } from 'components/Vault/utils';
import { formatNumber } from 'utils/formatter';
import { useIsVaultExitable } from 'hooks/core/use-is-vault-exitable';
import { AnalyticsService } from 'services/AnalyticsService';
import { AnalyticsEvent } from 'constants/events';
import { useLocation } from 'react-router-dom';
import { BigNumber } from 'ethers';
import { Nullable } from 'types/util';
import { useTokenContractAllowance } from 'hooks/core/use-token-contract-allowance';
import env from 'constants/env';

interface LocationState {
  earlyClaimSubvaultAddress: string;
  isClaimingEarly: boolean;
  earlyClaimAmount: Nullable<BigNumber>;
}

export const Claim = () => {
  const { activeVault, vaultGroups } = useVaultContext();
  const vault = activeVault!;

  const location = useLocation();
  const state = location.state as LocationState;

  const { earlyClaimSubvaultAddress, isClaimingEarly, earlyClaimAmount } = state || {
    earlyClaimSubvaultAddress: '',
    isClaimingEarly: false,
    earlyClaimAmount: ZERO,
  };

  const [amount, setAmount] = useState<string>('');
  const [{ balance, isLoading: getBalanceLoading }, getBalance] = useVaultBalance(vault.id);
  const [{ isLoading: refreshLoading }, refreshWalletState] = useRefreshWalletState();
  const { withdraw: withdrawRequest, withdrawEarly: earlyWithdrawRequest } = useWithdrawFromVault(
    vault!.id,
    async () => {
      await refreshWalletState();
      await getBalance();
      AnalyticsService.captureEvent(AnalyticsEvent.Vault.Claim, { name: vault.id, amount });
      setAmount('');
    }
  );

  const [withdraw, { isLoading: withdrawIsLoading, error }] = withdrawRequest;
  const [earlyWithdraw, { isLoading: earlyWithdrawIsLoading, error: earlyWithdrawError }] = earlyWithdrawRequest;

  const [checkExitStatus, { response: canExit }] = useIsVaultExitable(vault.id);

  const [
    { allowance: earlyWithdrawAllowance, isLoading: earlyWithdrawAllowanceIsLoading },
    increaseEarlyWithdrawAllowance,
  ] = useTokenContractAllowance(
    { address: earlyClaimSubvaultAddress, name: 'vault ERC20' },
    env.contracts.vaultEarlyExit
  );

  useEffect(() => {
    if (!isClaimingEarly) {
      checkExitStatus();
    }
  }, [isClaimingEarly, checkExitStatus]);

  const handleUpdateAmount = (amount: string) => {
    setAmount(Number(amount) === 0 ? '' : amount);
  };

  const bigInputValue = getBigNumberFromString(amount);
  const formattedBalance = formatBigNumber(balance);

  const buttonIsDisabled =
    (isClaimingEarly && (earlyWithdrawIsLoading || !earlyClaimAmount)) ||
    (!isClaimingEarly &&
      (getBalanceLoading || refreshLoading || withdrawIsLoading || !amount || bigInputValue.gt(balance)));

  let claimLabel =
    balance.gt(ZERO) && !!canExit ? (
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

  if (isClaimingEarly) {
    claimLabel = (
      <ClaimableLabel>
        Claiming {formatTemple(earlyClaimAmount)} Early
        <TempleAmountLink>&nbsp; {/* Note: this node is here for formatting/spacing */}</TempleAmountLink>
      </ClaimableLabel>
    );
  }

  useEffect(() => {
    if (error) {
      console.error(error);
    }
    if (earlyWithdrawError) {
      console.error(earlyWithdrawError);
    }
  }, [error, earlyWithdrawError]);

  const inputAmount = isClaimingEarly ? formatBigNumber(earlyClaimAmount || ZERO) : amount;

  return (
    <VaultContent>
      <Header>Claim</Header>
      {claimLabel}
      <VaultInput
        tickerSymbol={TICKER_SYMBOL.TEMPLE_TOKEN}
        handleChange={(value) => handleUpdateAmount(value.toString())}
        isNumber
        placeholder="0.00"
        value={inputAmount}
        disabled={balance.lte(ZERO) || !canExit || isClaimingEarly}
      />
      {!!error && <ErrorLabel>{error.message || 'Something went wrong'}</ErrorLabel>}
      {!!earlyWithdrawError && <ErrorLabel>{earlyWithdrawError.message || 'Something went wrong'}</ErrorLabel>}

      {earlyWithdrawAllowance !== 0 && (
        <VaultButton
          label={isClaimingEarly ? 'Claim Early' : 'Claim'}
          autoWidth
          marginTop={error ? '0.5rem' : '3.5rem'}
          disabled={buttonIsDisabled}
          onClick={async () => {
            if (isClaimingEarly) {
              await earlyWithdraw(earlyClaimSubvaultAddress, earlyClaimAmount || ZERO);
            } else {
              await withdraw(amount);
            }
          }}
        />
      )}
      {earlyWithdrawAllowance === 0 && (
        <VaultButton
          label={'Approve'}
          autoWidth
          marginTop={error ? '0.5rem' : '3.5rem'}
          disabled={!earlyWithdrawAllowanceIsLoading}
          onClick={async () => {
            await increaseEarlyWithdrawAllowance();
          }}
        />
      )}
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
