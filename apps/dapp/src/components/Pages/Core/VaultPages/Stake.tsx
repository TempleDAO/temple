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
import { useOGTempleStakingValue } from 'hooks/core/use-ogtemple-staking-value';

const ENV = import.meta.env;

export const Stake = () => {
  const { activeVault: vault } = useVaultContext();
  const { isConnected } = useWallet();

  const {
    options,
    ticker,
    setTicker,
    balances,
    stakingAmount,
    setStakingAmount,
  } = useStakeOptions();

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

  const [getOGStakingValue, { response: stakingValue }] = useOGTempleStakingValue();

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
    
    setStakingAmount(amount === 0 ? '' : amount);
    
    if (amount <= 0) {
      return;
    }

    if (ticker === TICKER_SYMBOL.FAITH) {
      getFaithDepositMultiplier(amount);
    } else if (ticker === TICKER_SYMBOL.OG_TEMPLE_TOKEN) {
      getOGStakingValue(amount);
    }
  };

  const getTokenBalanceForCurrentTicker = () => {
    switch (ticker) {
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return balances.temple;
      case TICKER_SYMBOL.FAITH:
        return balances.temple;
      case TICKER_SYMBOL.OG_TEMPLE_TOKEN:
        return balances.ogTemple;
    }
    console.error(`Programming Error: ${ticker} not implemented.`);
    return 0;
  };


  const tokenBalance = getTokenBalanceForCurrentTicker();
  const numberStakingAmount = Number(stakingAmount || 0);
  const stakeAmountExceedsTokenBalance = numberStakingAmount > tokenBalance;

  const stakeButtonDisabled =
    !isConnected ||
    stakeAmountExceedsTokenBalance ||
    refreshIsLoading ||
    !numberStakingAmount ||
    depositLoading ||
    allowanceLoading;

  const error =
    !!depositError && ((depositError as MetaMaskError).data?.message || depositError.message || 'Something went wrong');

  let zapMessage: ReactNode = null;
  if (ticker === TICKER_SYMBOL.FAITH && balances.faith > 0 && numberStakingAmount > 0) {
    if (faithMultiplierLoading) {
      zapMessage = <EllipsisLoader />;
    } else if (faithDepositMultiplier) {
      const bonusAmount = faithDepositMultiplier - numberStakingAmount;
      zapMessage = <>Burn all your FAITH ({balances.faith}) and receive {bonusAmount.toFixed(2)} bonus TEMPLE.</>
    }
  } else if (ticker === TICKER_SYMBOL.OG_TEMPLE_TOKEN && balances.ogTemple > 0 && (stakingValue || 0) > 0) {
    zapMessage = <>Unstake {numberStakingAmount} OGTemple and deposit {stakingValue} TEMPLE.</>;
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
      {!stakeAmountExceedsTokenBalance && !!numberStakingAmount && !!zapMessage && <AmountInTemple>{zapMessage}</AmountInTemple>} 
      {(joiningFee !== null && !!numberStakingAmount) && (
        <JoiningFee>
          <Tooltip
            content="The Joining Fee is meant to offset compounded earnings received by late joiners. The fee increases the further we are into the joining period."
            inline
          >
            Joining Fee{' '}
          </Tooltip>
          : {joiningFee * numberStakingAmount} $T
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
  const { balance: { temple, ogTemple } } = useWallet();
  const { faith: { usableFaith } } = useFaith();
  const [stakingAmount, setStakingAmount] = useState<string | number>('');

  const options = [
    { value: TICKER_SYMBOL.TEMPLE_TOKEN, label: 'TEMPLE' },
  ];

  if (usableFaith > 0) {
    options.push({ value: TICKER_SYMBOL.FAITH, label: 'TEMPLE & FAITH' });
  }

  if (ogTemple > 0) {
    options.push({ value: TICKER_SYMBOL.OG_TEMPLE_TOKEN, label: 'OGTemple' });
  }

  const [ticker, setTicker] = useState<TICKER_SYMBOL>(options[0].value as TICKER_SYMBOL);

  return {
    options,
    ticker,
    setTicker,
    stakingAmount,
    setStakingAmount,
    balances: {
      faith: usableFaith,
      temple,
      ogTemple,
    },
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
