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
import { useGetZappedAssetValue } from 'hooks/core/use-get-zapped-asset-value';
import EllipsisLoader from 'components/EllipsisLoader';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';

const TEMPLE_AND_FAITH: `${TICKER_SYMBOL.TEMPLE_TOKEN}${TICKER_SYMBOL.FAITH}` =
  `${TICKER_SYMBOL.TEMPLE_TOKEN}${TICKER_SYMBOL.FAITH}`;
const OG_TEMPLE_AND_FAITH: `${TICKER_SYMBOL.OG_TEMPLE_TOKEN}${TICKER_SYMBOL.FAITH}` =
  `${TICKER_SYMBOL.OG_TEMPLE_TOKEN}${TICKER_SYMBOL.FAITH}`;

export const Stake = () => {
  const { activeVault: vault } = useVaultContext();
  const { isConnected } = useWallet();

  const { options, ticker, setTicker, balances, stakingAmount, setStakingAmount } = useStakeOptions();

  const [getZappedAssetValue, {
    response: zappedAssetValue,
    isLoading: zappedAssetLoading,
    args: zapArgs,
  }] = useGetZappedAssetValue();

  const [getVaultJoiningFee, { response: joiningFeeResponse, isLoading: joiningFeeLoading }] =
    useVaultJoiningFee(vault);
  
  const joiningFee = !isConnected || joiningFeeLoading || !joiningFeeResponse ? null : joiningFeeResponse;

  useEffect(() => {
    if (isConnected) {
      getVaultJoiningFee();
    }
  }, [isConnected, getVaultJoiningFee]);

  const [_, refreshBalance] = useVaultBalance(vault.id);
  const [{ isLoading: refreshIsLoading }, refreshWalletState] = useRefreshWalletState();
  const [deposit, { isLoading: depositLoading, error: depositError }] = useDepositToVault(vault.id, async () => {
    refreshBalance();
    await refreshWalletState();
  });

  const getTickerFromSelectOption = () => {
    switch (ticker) {
      case TICKER_SYMBOL.TEMPLE_TOKEN:
      case TEMPLE_AND_FAITH:
        return TICKER_SYMBOL.TEMPLE_TOKEN;
      case TICKER_SYMBOL.OG_TEMPLE_TOKEN:
      case OG_TEMPLE_AND_FAITH:
        return TICKER_SYMBOL.OG_TEMPLE_TOKEN;
    }
    console.error(`Programming Error: ${ticker} not implemented.`);
  };

  const tokenTicker = getTickerFromSelectOption();

  const getTokenBalanceForSelectedOption = () => {
    switch (ticker) {
      case TICKER_SYMBOL.TEMPLE_TOKEN:
      case TEMPLE_AND_FAITH:
        return balances.temple;
      case TICKER_SYMBOL.OG_TEMPLE_TOKEN:
      case OG_TEMPLE_AND_FAITH:
        return balances.ogTemple;
    }
    console.error(`Programming Error: ${ticker} not implemented.`);
    return 0;
  };

  const [{ allowance, isLoading: allowanceLoading }, increaseAllowance] = useTokenVaultProxyAllowance(tokenTicker);

  const handleUpdateStakingAmount = (value: string) => {
    const amount = Number(value || '0');

    setStakingAmount(amount === 0 ? '' : value);

    if (amount <= 0) {
      return;
    }

    if (ticker !== TICKER_SYMBOL.TEMPLE_TOKEN) {
      const isFaithZap = ticker === TEMPLE_AND_FAITH || ticker === OG_TEMPLE_AND_FAITH;
      const tokenTicker = getTickerFromSelectOption();
      getZappedAssetValue(tokenTicker!, value, isFaithZap);
    }
  };

  const tokenBalance = getTokenBalanceForSelectedOption();
  const stakingAmountBigNumber = getBigNumberFromString(stakingAmount);
  const bigTokenBalance = getBigNumberFromString(tokenBalance.toString());
  const amountIsOutOfBounds = stakingAmountBigNumber.gt(bigTokenBalance) || stakingAmountBigNumber.lte(ZERO);

  const stakeButtonDisabled =
    !isConnected || amountIsOutOfBounds || refreshIsLoading || depositLoading || allowanceLoading;

  const error =
    !!depositError && ((depositError as MetaMaskError).data?.message || depositError.message || 'Something went wrong');

  const getZapMessage = (): ReactNode => {
    if (amountIsOutOfBounds) {
      return null;
    }

    // Temple is not a zapped asset.
    if (ticker === TICKER_SYMBOL.TEMPLE_TOKEN) {
      return null;
    }

    // Safeguard against old requests.
    if (zapArgs?.[0] !== tokenTicker || zapArgs?.[1] !== stakingAmount) {
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

    // Depositing OGTemple without Faith
    if (ticker === TICKER_SYMBOL.OG_TEMPLE_TOKEN) {
      return (
        <>
          Unstake {formatNumber(formatBigNumber(stakingAmountBigNumber))} {TICKER_SYMBOL.OG_TEMPLE_TOKEN} and deposit{' '}
          {formatNumber(formatBigNumber(temple))} {TICKER_SYMBOL.TEMPLE_TOKEN}.
        </>
      );
    }

    if (bonus.lte(ZERO)) {
      return null;
    }

    if (ticker === TEMPLE_AND_FAITH) {
      return (
        <>
          Burn all your {TICKER_SYMBOL.FAITH} ({balances.faith}) and receive{' '}
          {formatNumber(formatBigNumber(bonus))} bonus
          {TICKER_SYMBOL.TEMPLE_TOKEN}.
        </>
      );
    }

    if (ticker === OG_TEMPLE_AND_FAITH) {
      return (
        <>
          Unstake {formatNumber(formatBigNumber(stakingAmountBigNumber))} {TICKER_SYMBOL.OG_TEMPLE_TOKEN} and deposit{' '}
          {formatNumber(formatBigNumber(temple))} {TICKER_SYMBOL.TEMPLE_TOKEN}.
          Burn all your {TICKER_SYMBOL.FAITH} ({balances.faith}) and receive{' '}
          {formatNumber(formatBigNumber(bonus))} bonus{' '}
          {TICKER_SYMBOL.TEMPLE_TOKEN}.
        </>
      );
    }

    return null;
  };

  const zapMessage = getZapMessage();

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
              handleUpdateStakingAmount('');
            }}
          />
        </SelectContainer>
      </DepositContainer>
      <VaultInput
        tickerSymbol={tokenTicker}
        handleChange={(value) => handleUpdateStakingAmount(value.toString())}
        hint={`Balance: ${formatNumber(tokenBalance)}`}
        onHintClick={() => {
          handleUpdateStakingAmount(tokenBalance.toString());
        }}
        isNumber
        placeholder="0.00"
        value={stakingAmount}
      />
      {!!zapMessage && <AmountInTemple>{zapMessage}</AmountInTemple>}
      {joiningFee !== null && !amountIsOutOfBounds && (
        <JoiningFee>
          <Tooltip
            content="The Joining Fee is meant to offset compounded earnings received by late joiners. The fee increases the further we are into the joining period."
            inline
          >
            Joining Fee{' '}
          </Tooltip>
          : {formatBigNumber(joiningFee.mul(stakingAmountBigNumber))} $T
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
            const useFaith = ticker === TEMPLE_AND_FAITH || ticker === OG_TEMPLE_AND_FAITH;
            await deposit(tokenTicker!, stakingAmount || '0', useFaith);
            setStakingAmount('');
          }}
        />
      )}
    </VaultContent>
  );
};

type TickerValue = TICKER_SYMBOL | typeof TEMPLE_AND_FAITH | typeof OG_TEMPLE_AND_FAITH;

const useStakeOptions = () => {
  const {
    balance: { temple, ogTemple },
  } = useWallet();
  const {
    faith: { usableFaith },
  } = useFaith();
  const [stakingAmount, setStakingAmount] = useState('');

  const options: { value: TickerValue, label: string}[] = [
    { value: TICKER_SYMBOL.TEMPLE_TOKEN, label: `${TICKER_SYMBOL.TEMPLE_TOKEN}` },
  ];

  if (ogTemple > 0) {
    options.push({ value: TICKER_SYMBOL.OG_TEMPLE_TOKEN, label: `${TICKER_SYMBOL.OG_TEMPLE_TOKEN}` });
  }

  if (usableFaith > 0) {
    if (temple > 0) {
      options.push({ value: TEMPLE_AND_FAITH, label: `${TICKER_SYMBOL.TEMPLE_TOKEN} & ${TICKER_SYMBOL.FAITH}` });
    }

    if (ogTemple > 0) {
      options.push({ value: OG_TEMPLE_AND_FAITH, label: `${TICKER_SYMBOL.OG_TEMPLE_TOKEN} & ${TICKER_SYMBOL.FAITH}` });
    }
  }

  const [ticker, setTicker] = useState<TickerValue>(options[0].value as TICKER_SYMBOL);

  useEffect(() => {
    if (ticker === TICKER_SYMBOL.OG_TEMPLE_TOKEN && ogTemple === 0) {
      // User deposited all of their OGTemple
      setTicker(TICKER_SYMBOL.TEMPLE_TOKEN);
    } else if (ticker === TEMPLE_AND_FAITH && usableFaith === 0) {
      // User burnt all their Faith with Temple
      setTicker(TICKER_SYMBOL.TEMPLE_TOKEN);
    } else if (ticker === OG_TEMPLE_AND_FAITH && usableFaith === 0) {
      if (ogTemple > 0) {
        // User burnt all their faith with OGTemple but has remaining OGTemple
        setTicker(TICKER_SYMBOL.OG_TEMPLE_TOKEN);
      } else {
        // User burnt all their faith with OGTemple.
        setTicker(TICKER_SYMBOL.TEMPLE_TOKEN);
      }
    }
  }, [ticker, usableFaith, ogTemple]);

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
