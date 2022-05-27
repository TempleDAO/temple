import { useState, useEffect, ReactNode } from 'react';
import styled from 'styled-components';

import { Option } from 'components/InputSelect/InputSelect';
import VaultContent, { VaultButton } from 'components/Pages/Core/VaultPages/VaultContent';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumber } from 'utils/formatter';
import { Header } from 'styles/vault';
import { theme } from 'styles/theme';
import { VaultInput } from 'components/Input/VaultInput';
import { CryptoSelect } from 'components/Input/CryptoSelect';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useDepositToVault } from 'hooks/core/use-deposit-to-vault';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { useWallet } from 'providers/WalletProvider';
import { MetaMaskError } from 'hooks/core/types';
import { useTokenVaultProxyAllowance } from 'hooks/core/use-token-vault-proxy-allowance';
import { useVaultBalance } from 'hooks/core/use-vault-balance';
import { useVaultJoiningFee } from 'hooks/core/use-vault-joining-fee';
import Tooltip from 'components/Tooltip/Tooltip';
import { useFaith } from 'providers/FaithProvider';
import { useFaithDepositMultiplier } from 'hooks/core/use-faith-deposit-multiplier';
import EllipsisLoader from 'components/EllipsisLoader';

const ENV = import.meta.env;

export const Stake = () => {
  const { activeVault: vault } = useVaultContext();
  const { balance, isConnected } = useWallet();

  const [
    getFaithDepositMultiplier, 
    { response: faithDepositMultiplier, isLoading: faithMultiplierLoading },
  ] = useFaithDepositMultiplier();

  const [getVaultJoiningFee, { response: joiningFeeResponse, isLoading: joiningFeeLoading }] = useVaultJoiningFee(vault);
  const joiningFee = (!isConnected || joiningFeeLoading) ? null : (joiningFeeResponse || 0);

  useEffect(() => {
    if (isConnected) {
      getVaultJoiningFee();
    }
  }, [isConnected, getVaultJoiningFee]);

  // UI amount to stake
  const [stakingAmount, setStakingAmount] = useState<string | number>('');
  const { options, ticker, setTicker, usableFaith } = useStakeOptions();

  const [_, refreshBalance] = useVaultBalance(vault?.id);
  const [{ isLoading: refreshIsLoading }, refreshWalletState] = useRefreshWalletState();
  const [deposit, { isLoading: depositLoading, error: depositError }] = useDepositToVault(vault.id, async () => {
    refreshBalance();
    refreshWalletState();
  });

  const [{ allowance, isLoading: allowanceLoading }, increaseAllowance] = useTokenVaultProxyAllowance(
    ticker,
  );
  
  const handleUpdateStakingAmount = (value: number | string) => {
    const amount = Number(value || 0);
    
    setStakingAmount(amount);
    
    if (amount > 0 && ticker === TICKER_SYMBOL.FAITH && usableFaith > 0) {
      // Get the faith bonus amount
      getFaithDepositMultiplier(amount);
    }
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
  const templeAmount = Number(stakingAmount || 0);

  const stakeButtonDisabled =
    !isConnected ||
    refreshIsLoading ||
    !templeAmount ||
    depositLoading ||
    allowanceLoading;

  const error =
    !!depositError && ((depositError as MetaMaskError).data?.message || depositError.message || 'Something went wrong');

  let faithBoostMessage: ReactNode = null;
  if (ticker === TICKER_SYMBOL.FAITH && usableFaith > 0 && templeAmount > 0) {
    if (faithMultiplierLoading) {
      faithBoostMessage = <EllipsisLoader />;
    } else if (faithDepositMultiplier) {
      const bonusAmount = faithDepositMultiplier - templeAmount;
      faithBoostMessage = <>Burn all your FAITH ({usableFaith}) and receive {bonusAmount.toFixed(2)} bonus TEMPLE.</>
    }
  }

  return (
    <VaultContent>
      <Header>Stake</Header>
      <DepositContainer>
        Deposit{' '}
        <SelectContainer>
          <CryptoSelect
            isSearchable={false}
            options={options}
            defaultValue={options[0]}
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
      {!!faithBoostMessage && <AmountInTemple>{faithBoostMessage}</AmountInTemple>} 
      {(joiningFee !== null && !!templeAmount) && (
        <JoiningFee>
          <Tooltip
            content="The Joining Fee is meant to offset compounded earnings received by late joiners. The fee increases the further we are into the joining period."
            inline
          >
            Joining Fee{' '}
          </Tooltip>
          : {joiningFee * templeAmount} $T
        </JoiningFee>
      )}
      {<ErrorLabel>{error}</ErrorLabel>}
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

const useStakeOptions = () => {
  const { faith: { usableFaith } } = useFaith();

  const options = [
    { value: TICKER_SYMBOL.TEMPLE_TOKEN, label: 'TEMPLE' },
  ];

  if (usableFaith > 0) {
    options.push({ value: TICKER_SYMBOL.FAITH, label: 'TEMPLE & FAITH' });
  }

  const [ticker, setTicker] = useState<TICKER_SYMBOL>(options[0].value as TICKER_SYMBOL);

  return {
    options,
    ticker,
    setTicker,
    usableFaith,
  };
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
  margin: 1rem 0 0;
`;

const ErrorLabel = styled.span`
  color: ${theme.palette.enclave.chaos};
  display: block;
  margin: 1rem 0 0;
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
