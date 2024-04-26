import { useState, useEffect } from 'react';
import styled from 'styled-components';

import { VaultInput } from 'components/Input/VaultInput';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { Header } from 'styles/vault';
import VaultContent, {
  VaultButton,
} from 'components/Pages/Core/VaultPages/VaultContent';
import { useWithdrawFromVault } from 'hooks/core/use-withdraw-from-vault';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { useVaultBalance } from 'hooks/core/use-vault-balance';
import { ZERO } from 'utils/bigNumber';
import {
  getBigNumberFromString,
  formatBigNumber,
  formatTemple,
} from 'components/Vault/utils';
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

const EMPTY_EARLY_CLAIM_STATE = {
  earlyClaimSubvaultAddress: '',
  isClaimingEarly: false,
  earlyClaimAmount: ZERO,
};

export const Claim = () => {
  const { activeVault } = useVaultContext();
  const vault = activeVault!;

  const location = useLocation();

  const state = location.state as LocationState;

  const [earlyClaimState, setEarlyClaimState] = useState({
    earlyClaimSubvaultAddress: state?.earlyClaimSubvaultAddress,
    isClaimingEarly: state?.isClaimingEarly,
    earlyClaimAmount: state?.earlyClaimAmount || ZERO,
  });

  const [amount, setAmount] = useState<string>('');
  const [{ balance, isLoading: getBalanceLoading }, getBalance] =
    useVaultBalance(vault.id);
  const [{ isLoading: refreshLoading }, refreshWalletState] =
    useRefreshWalletState();
  const { withdrawEarly: earlyWithdrawRequest } = useWithdrawFromVault(
    vault!.id,
    async () => {
      await refreshWalletState();
      await getBalance();
      AnalyticsService.captureEvent(AnalyticsEvent.Vault.Claim, {
        name: vault.id,
        amount,
      });
      setAmount('');
    }
  );

  const [
    earlyWithdraw,
    { isLoading: earlyWithdrawIsLoading, error: earlyWithdrawError },
  ] = earlyWithdrawRequest;

  const [checkExitStatus, { response: canExit }] = useIsVaultExitable(vault.id);

  const [
    {
      allowance: earlyWithdrawAllowance,
      isLoading: earlyWithdrawAllowanceIsLoading,
    },
    increaseEarlyWithdrawAllowance,
  ] = useTokenContractAllowance(
    { address: earlyClaimState.earlyClaimSubvaultAddress, name: 'vault ERC20' },
    env.contracts.vaultEarlyExit
  );

  useEffect(() => {
    if (!earlyClaimState.isClaimingEarly) {
      checkExitStatus();
    }
  }, [earlyClaimState.isClaimingEarly, checkExitStatus]);

  useEffect(() => {
    if (earlyClaimState.isClaimingEarly) {
      setAmount(formatBigNumber(earlyClaimState.earlyClaimAmount || ZERO));
    }
  }, []);

  const clearEarlyExitState = () => {
    setEarlyClaimState(EMPTY_EARLY_CLAIM_STATE);
  };

  const handleUpdateAmount = (amount: string) => {
    setAmount(Number(amount) === 0 ? '' : amount);
  };

  const bigInputValue = getBigNumberFromString(amount);
  const formattedBalance = formatBigNumber(balance);

  const buttonIsDisabled =
    (earlyClaimState.isClaimingEarly &&
      (earlyWithdrawIsLoading || !earlyClaimState.earlyClaimAmount)) ||
    (!earlyClaimState.isClaimingEarly &&
      (getBalanceLoading ||
        refreshLoading ||
        !amount ||
        bigInputValue.gt(balance)));

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
        <TempleAmountLink>
          &nbsp; {/* Note: this node is here for formatting/spacing */}
        </TempleAmountLink>
      </ClaimableLabel>
    );

  if (earlyClaimState.isClaimingEarly) {
    claimLabel = (
      <ClaimableLabel>
        Claiming {formatTemple(earlyClaimState.earlyClaimAmount)} Early
        <TempleAmountLink>
          &nbsp; {/* Note: this node is here for formatting/spacing */}
        </TempleAmountLink>
      </ClaimableLabel>
    );
  }

  useEffect(() => {
    if (earlyWithdrawError) {
      console.error(earlyWithdrawError);
    }
  }, [earlyWithdrawError]);

  const isRegularClaimPossible = balance.lte(ZERO) || !canExit;
  const isInputDisabled =
    isRegularClaimPossible && !earlyClaimState.isClaimingEarly;

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
        disabled={isInputDisabled}
      />
      {!!earlyWithdrawError && (
        <ErrorLabel>
          {earlyWithdrawError.message || 'Something went wrong'}
        </ErrorLabel>
      )}

      {earlyWithdrawAllowance !== 0 && (
        <VaultButton
          label={earlyClaimState.isClaimingEarly ? 'Claim Early' : 'Claim'}
          autoWidth
          disabled={buttonIsDisabled}
          onClick={async () => {
            if (earlyClaimState.isClaimingEarly) {
              await earlyWithdraw(
                earlyClaimState.earlyClaimSubvaultAddress,
                amount
              );
              clearEarlyExitState();
            }
          }}
        />
      )}
      {earlyWithdrawAllowance === 0 && (
        <VaultButton
          label={'Approve'}
          autoWidth
          disabled={earlyWithdrawAllowanceIsLoading}
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
