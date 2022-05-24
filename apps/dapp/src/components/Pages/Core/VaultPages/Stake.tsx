import { useState, ReactNode, useEffect } from 'react';
import styled from 'styled-components';
import { BigNumber } from 'ethers';

import { Option } from 'components/InputSelect/InputSelect';
import VaultContent, { VaultButton } from 'components/Pages/Core/VaultPages/VaultContent';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumber } from 'utils/formatter';
import { Header } from 'styles/vault';
import { theme } from 'styles/theme';
import { VaultInput } from 'components/Input/VaultInput';
import { CryptoSelect } from 'components/Input/CryptoSelect';
import useRequestState, { createMockRequest } from 'hooks/use-request-state';
import EllipsisLoader from 'components/EllipsisLoader';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useDepositToVault } from 'hooks/core/use-deposit-to-vault';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { useWallet } from 'providers/WalletProvider';
import { toAtto } from 'utils/bigNumber';
import { MetaMaskError } from 'hooks/core/types';
import { useTokenVaultAllowance } from 'hooks/core/use-token-vault-allowance';
import { useVaultBalance } from 'hooks/core/use-vault-balance';
import { useVaultJoiningFee } from 'hooks/core/use-vault-joining-fee';
import Tooltip from 'components/Tooltip/Tooltip';

const OPTIONS = [
  { value: TICKER_SYMBOL.TEMPLE_TOKEN, label: 'TEMPLE' },
  { value: TICKER_SYMBOL.FAITH, label: 'TEMPLE & FAITH' },
];

export const Stake = () => {
  const { activeVault: vault } = useVaultContext();
  const { balance, isConnected } = useWallet();

  const [getVaultJoiningFee, { response: joiningFeeResponse, isLoading: joiningFeeLoading }] = useVaultJoiningFee(vault);
  const joiningFee = (!isConnected || joiningFeeLoading) ? null : (joiningFeeResponse || 0);

  useEffect(() => {
    if (isConnected) {
      getVaultJoiningFee();
    }
  }, [isConnected, getVaultJoiningFee]);

  // UI amount to stake
  const [stakingAmount, setStakingAmount] = useState<string | number>('');

  // Currently selected token
  const [ticker, setTicker] = useState<TICKER_SYMBOL>(OPTIONS[0].value as TICKER_SYMBOL);

  const [_, refreshBalance] = useVaultBalance(vault.id);
  const [{ isLoading: refreshIsLoading }, refreshWalletState] = useRefreshWalletState();
  const [deposit, { isLoading: depositLoading, error: depositError }] = useDepositToVault(vault.id, async () => {
    refreshBalance();
    refreshWalletState();
  });

  const [{ allowance, isLoading: allowanceLoading }, increaseAllowance] = useTokenVaultAllowance(vault.id, ticker);
  
  const handleUpdateStakingAmount = (value: number | string) => {
    setStakingAmount(Number(value) === 0 ? '' : value);
  };

  const getTokenBalanceForCurrentTicker = () => {
    switch (ticker) {
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return balance.temple;
      case TICKER_SYMBOL.FAITH:
        return balance.temple;
    }
    console.error(`Programming Error: ${ticker} not implemented.`);
    return 0;
  };

  const tokenBalance = getTokenBalanceForCurrentTicker();
  const templeAmount = stakingAmount || 0;

  const stakeButtonDisabled =
    !isConnected ||
    refreshIsLoading ||
    !templeAmount ||
    depositLoading ||
    allowanceLoading;

  const error =
    !!depositError && ((depositError as MetaMaskError).data?.message || depositError.message || 'Something went wrong');

  return (
    <VaultContent>
      <Header>Stake</Header>
      <DepositContainer>
        Deposit{' '}
        <SelectContainer>
          <CryptoSelect
            isSearchable={false}
            options={OPTIONS}
            defaultValue={OPTIONS[0]}
            onChange={(val: Option) => {
              setTicker(val.value as TICKER_SYMBOL);
              handleUpdateStakingAmount(0);
            }}
          />
        </SelectContainer>
      </DepositContainer>
      <VaultInput
        tickerSymbol={ticker}
        handleChange={handleUpdateStakingAmount}
        hint={`Balance: ${formatNumber(tokenBalance)}`}
        onHintClick={() => {
          handleUpdateStakingAmount(tokenBalance);
        }}
        isNumber
        placeholder="0.00"
        value={stakingAmount}
      />
      {joiningFee !== null && (
        <JoiningFee>
          <Tooltip
            content="The Joining Fee is meant to offset compounded earnings received by late joiners. The fee increases the further we are into the joining period."
            inline
          >
            Joining Fee{' '}
          </Tooltip>
          : {joiningFee} $T
        </JoiningFee>
      )}
      <ErrorLabel>{error}</ErrorLabel>
      {allowance === 0 && (
        <VaultButton
          label="Approve"
          autoWidth
          disabled={allowanceLoading}
          onClick={async () => {
            return increaseAllowance();
          }}
        />
      )}
      {allowance !== 0 && (
        <VaultButton
          label="Stake"
          autoWidth
          disabled={stakeButtonDisabled}
          loading={refreshIsLoading || depositLoading}
          onClick={async () => {
            const amountToDeposit = !stakingAmount ? 0 : Number(stakingAmount);
            await deposit(ticker, amountToDeposit);
            setStakingAmount('');
          }}
        />
      )}
    </VaultContent>
  );
};

const SelectContainer = styled.div`
  margin: 0 auto;
  width: 50%;
  padding: 1rem;
  display: inline-block;
  z-index: 4;
`;

const AmountInTemple = styled.span`
  color: ${theme.palette.brandLight};
  display: block;
  margin: 1rem 0;
  height: 1.5rem;
`;

const ErrorLabel = styled.span`
  color: ${theme.palette.enclave.chaos};
  display: block;
  margin: 1rem;
`;

const DepositContainer = styled.div`
  color: ${theme.palette.brandLight};
  font-size: 1.5rem;
  padding: 1.5rem 0 1.2rem;
  display: inline-block;
`;

const JoiningFee = styled.span`
  color: ${theme.palette.brandLight};
  display: block;
  padding: 1rem 0 0;
  font-size: 1.4rem;
`;
