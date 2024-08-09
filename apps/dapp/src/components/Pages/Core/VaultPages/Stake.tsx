import { useState, useEffect, ReactNode } from 'react';
import styled from 'styled-components';

import { Option } from 'components/InputSelect/InputSelect';
import VaultContent, {
  VaultButton,
} from 'components/Pages/Core/VaultPages/VaultContent';
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
import { useGetZappedAssetValue } from 'hooks/core/use-get-zapped-asset-value';
import EllipsisLoader from 'components/EllipsisLoader';
import { ZERO } from 'utils/bigNumber';
import {
  getBigNumberFromString,
  formatBigNumber,
  formatJoiningFee,
} from 'components/Vault/utils';
import { AnalyticsService } from 'services/AnalyticsService';
import { AnalyticsEvent } from 'constants/events';

export const Stake = () => {
  const { activeVault } = useVaultContext();
  const vault = activeVault!;
  const { isConnected } = useWallet();

  const {
    options,
    option,
    setOption,
    balances,
    stakingAmount,
    setStakingAmount,
  } = useStakeOptions();

  const [
    getZappedAssetValue,
    {
      response: zappedAssetValue,
      isLoading: zappedAssetLoading,
      args: zapArgs,
    },
  ] = useGetZappedAssetValue();

  const [
    getVaultJoiningFee,
    { response: joiningFeeResponse, isLoading: joiningFeeLoading },
  ] = useVaultJoiningFee(vault);

  const joiningFee =
    !isConnected || joiningFeeLoading || !joiningFeeResponse
      ? null
      : joiningFeeResponse;

  useEffect(() => {
    if (isConnected) {
      getVaultJoiningFee();
    }
  }, [isConnected, getVaultJoiningFee]);

  const [_, refreshBalance] = useVaultBalance(vault.id);
  const [{ isLoading: refreshIsLoading }, refreshWalletState] =
    useRefreshWalletState();
  const [deposit, { isLoading: depositLoading, error: depositError }] =
    useDepositToVault(vault.id, async (ticker, amount) => {
      refreshBalance();
      refreshWalletState();
      AnalyticsService.captureEvent(AnalyticsEvent.Vault.Deposit, {
        name: vault.id,
        amount,
        ticker,
      });
    });

  const getTickerFromSelectOption = () => {
    switch (option) {
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return TICKER_SYMBOL.TEMPLE_TOKEN;
      case TICKER_SYMBOL.OG_TEMPLE_TOKEN:
        return TICKER_SYMBOL.OG_TEMPLE_TOKEN;
    }
    console.error(`Programming Error: ${option} not implemented.`);
  };

  const ticker = getTickerFromSelectOption();

  const getTokenBalanceForSelectedOption = () => {
    switch (option) {
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return balances.temple;
      case TICKER_SYMBOL.OG_TEMPLE_TOKEN:
        return balances.ogTemple;
    }
    console.error(`Programming Error: ${option} not implemented.`);
  };

  const [{ allowance }, increaseAllowance] =
    useTokenVaultProxyAllowance(ticker);

  const handleUpdateStakingAmount = (value: string) => {
    const amount = Number(value || '0');

    setStakingAmount(amount === 0 ? '' : value);

    if (amount <= 0) {
      return;
    }

    if (option !== TICKER_SYMBOL.TEMPLE_TOKEN) {
      const ticker = getTickerFromSelectOption();
      getZappedAssetValue(ticker!, value, false);
    }
  };

  const tokenBalance = getTokenBalanceForSelectedOption();
  const stakingAmountBigNumber = getBigNumberFromString(stakingAmount);
  const bigTokenBalance = tokenBalance!;
  const amountIsOutOfBounds =
    stakingAmountBigNumber.gt(bigTokenBalance) ||
    stakingAmountBigNumber.lte(ZERO);

  const error =
    !!depositError &&
    ((depositError as MetaMaskError).data?.message ||
      depositError.message ||
      'Something went wrong');

  const getZapMessage = (): ReactNode => {
    if (amountIsOutOfBounds) {
      return null;
    }

    // Temple is not a zapped asset.
    if (option === TICKER_SYMBOL.TEMPLE_TOKEN) {
      return null;
    }

    // Safeguard against old requests.
    if (zapArgs?.[0] !== ticker || zapArgs?.[1] !== stakingAmount) {
      return null;
    }

    // Request is loading
    if (zappedAssetLoading) {
      return <EllipsisLoader />;
    }

    if (!zappedAssetValue) {
      return null;
    }

    const { temple, bonus } = zappedAssetValue;

    if (option === TICKER_SYMBOL.OG_TEMPLE_TOKEN) {
      return (
        <>
          Unstake {formatNumber(formatBigNumber(stakingAmountBigNumber))}{' '}
          {TICKER_SYMBOL.OG_TEMPLE_TOKEN} and deposit{' '}
          {formatNumber(formatBigNumber(temple))} {TICKER_SYMBOL.TEMPLE_TOKEN}.
        </>
      );
    }

    if (bonus.lte(ZERO)) {
      return null;
    }

    return null;
  };

  const getJoiningFeeMessage = (): ReactNode => {
    if (amountIsOutOfBounds || joiningFee === null) {
      return null;
    }

    let depositAmount = stakingAmountBigNumber;
    if (option !== TICKER_SYMBOL.TEMPLE_TOKEN) {
      // If the option is not TEMPLE then we need to use the result from the zap request.
      if (
        zapArgs?.[0] !== ticker ||
        zapArgs?.[1] !== stakingAmount ||
        !zappedAssetValue
      ) {
        // Zap request is pending.
        return null;
      }
      // the deposit amount is the total zapped temple + bonuses.
      depositAmount = zappedAssetValue.total;
    }

    return (
      <JoiningFee>
        <Tooltip
          content={
            'The Joining Fee is meant to offset compounded earnings received by late joiners. ' +
            'The fee increases the further we are into the joining period.'
          }
          inline
        >
          Joining Fee{' '}
        </Tooltip>
        :{' '}
        {formatNumber(
          formatBigNumber(formatJoiningFee(depositAmount, joiningFee))
        )}{' '}
        $T
      </JoiningFee>
    );
  };

  const zapMessage = getZapMessage();
  const joiningFeeMessage = getJoiningFeeMessage();

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
              setOption(val.value as TICKER_SYMBOL);
              handleUpdateStakingAmount('');
            }}
          />
        </SelectContainer>
      </DepositContainer>
      <VaultInput
        tickerSymbol={ticker}
        handleChange={(value) => handleUpdateStakingAmount(value.toString())}
        hint={`Balance: ${formatNumber(formatBigNumber(tokenBalance!))}`}
        onHintClick={() => {
          handleUpdateStakingAmount(formatBigNumber(tokenBalance!));
        }}
        isNumber
        placeholder="0.00"
        value={stakingAmount}
      />
      {!!zapMessage && <AmountInTemple>{zapMessage}</AmountInTemple>}
      {joiningFeeMessage}
      {<ErrorLabel>{error}</ErrorLabel>}
      {allowance === 0 && (
        <VaultButton
          label="Approve"
          autoWidth
          disabled={true}
          onClick={async () => {
            return increaseAllowance();
          }}
        />
      )}
      {allowance !== 0 && (
        <VaultButton
          label="Stake"
          autoWidth
          disabled={true}
          loading={refreshIsLoading || depositLoading}
          onClick={async () => {
            await deposit(ticker!, stakingAmount || '0', false);
            setStakingAmount('');
          }}
        />
      )}
    </VaultContent>
  );
};

type TickerValue = TICKER_SYMBOL;

const useStakeOptions = () => {
  const {
    balance: { TEMPLE: temple, OGTEMPLE: ogTemple },
  } = useWallet();
  const [stakingAmount, setStakingAmount] = useState('');

  const options: { value: TickerValue; label: string }[] = [
    {
      value: TICKER_SYMBOL.TEMPLE_TOKEN,
      label: `${TICKER_SYMBOL.TEMPLE_TOKEN}`,
    },
  ];

  if (ogTemple.gt(ZERO)) {
    options.push({
      value: TICKER_SYMBOL.OG_TEMPLE_TOKEN,
      label: `${TICKER_SYMBOL.OG_TEMPLE_TOKEN}`,
    });
  }

  const [option, setOption] = useState(options[0].value);

  useEffect(() => {
    if (option === TICKER_SYMBOL.OG_TEMPLE_TOKEN && ogTemple.eq(ZERO)) {
      // User deposited all of their OGTemple
      setOption(TICKER_SYMBOL.TEMPLE_TOKEN);
    }
  }, [option, ogTemple]);

  return {
    options,
    option,
    setOption,
    stakingAmount,
    setStakingAmount,
    balances: {
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
