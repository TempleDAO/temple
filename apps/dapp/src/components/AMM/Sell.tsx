import React, { FC, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Input } from 'components/Input/Input';
import { BigNumber } from 'ethers';
import { formatNumber } from 'utils/formatter';
import {
  ConvoFlowTitle,
  SwapArrows,
  TitleWrapper,
  Spacer,
  ViewContainer,
} from 'components/AMM/helpers/components';
import { copyBalance } from 'components/AMM/helpers/methods';
import Slippage from 'components/Slippage/Slippage';
import { Button } from 'components/Button/Button';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { noop } from 'utils/helpers';
import { STABLE_COIN_ADDRESS, FEI_ADDRESS } from 'providers/env';
import useRefreshableDashboardMetrics from 'hooks/use-refreshable-dashboard-metrics';

interface SizeProps {
  small?: boolean;
}
interface BuyProps extends SizeProps {
  onSwapArrowClick: () => void;
}

const ENV_VARS = import.meta.env;

const dropdownOptions = [
  {
    label: TICKER_SYMBOL.FEI,
    value: FEI_ADDRESS,
  },
  {
    label: TICKER_SYMBOL.STABLE_TOKEN,
    value: STABLE_COIN_ADDRESS,
  },
];

export const Sell: FC<BuyProps> = ({ onSwapArrowClick, small }) => {
  const { balance, getBalance, updateBalance } = useWallet();
  const { sell, getSellQuote, templePrice, updateTemplePrice } = useSwap();
  const dashboardMetrics = useRefreshableDashboardMetrics();

  const [stableCoinWalletAmount, setStableCoinWalletAmount] =
    useState<number>(0);
  const [rewards, setRewards] = useState<number | ''>('');
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(0);
  const [slippage, setSlippage] = useState<number>(1);
  const [minAmountOut, setMinAmountOut] = useState<number>(0);
  const [templeAmount, setTempleAmount] = useState<number | ''>('');
  const [selectedToken, setSelectedToken] = useState({
    address: FEI_ADDRESS,
    symbol: TICKER_SYMBOL.FEI,
  });
  const [isFraxHidden, setIsFraxHidden] = useState(true);

  const iv = dashboardMetrics?.iv || 0.65;

  const isIvSwap = (quote: BigNumber | void, value: number) =>
    !!quote && fromAtto(quote) <= value * iv;

  const handleUpdateTempleAmount = async (value: number | '') => {
    setTempleAmount(value === 0 ? '' : value);
    if (value) {
      const sellQuote = await getSellQuote(
        toAtto(value),
        selectedToken.address
      );

      // if this sell is going to defend or price in this token is,
      // too low, auto-select FEI
      if (
        !isFraxHidden &&
        (isIvSwap(sellQuote, value) ||
          templePrice <=
            iv * ENV_VARS.VITE_PUBLIC_FRAX_SELL_DISABLED_IV_MULTIPLE)
      ) {
        setIsFraxHidden(true);
        setSelectedToken({
          symbol: dropdownOptions[0].label,
          address: dropdownOptions[0].value,
        });
        updateTemplePrice(dropdownOptions[0].value);
      }

      setRewards(fromAtto(sellQuote || BigNumber.from(0) || 0));
    } else {
      setRewards('');
    }
  };

  const handleUpdateSlippageForSell = async (value: number) => {
    setSlippage(value);
  };

  const handleSurrenderTemple = async () => {
    try {
      if (templeAmount) {
        // ( 'current price' * 'FRAX sacrificing' )  * (1 - SlippageSetting )
        const minAmountOut = templeAmount * templePrice * (1 - slippage / 100);
        setMinAmountOut(minAmountOut);

        const sellQuote = await getSellQuote(
          toAtto(templeAmount),
          selectedToken.address
        );

        if (minAmountOut <= rewards || isIvSwap(sellQuote, templeAmount)) {
          await sell(
            toAtto(templeAmount),
            toAtto(minAmountOut),
            isIvSwap(sellQuote, templeAmount),
            selectedToken.address
          );
          getBalance();
          handleUpdateTempleAmount(0);
        }
      }
    } catch (e) {
      console.info(e);
    }
  };

  useEffect(() => {
    const setBalanceState = async () => {
      await updateTemplePrice(selectedToken.address);

      setTempleWalletAmount(balance.temple);

      if (selectedToken.symbol === TICKER_SYMBOL.FEI) {
        setStableCoinWalletAmount(balance.fei);
      } else {
        setStableCoinWalletAmount(balance.stableCoin);
      }
      await handleUpdateTempleAmount(templeAmount);
    };
    if (balance) {
      setBalanceState();
    }
  }, [balance, selectedToken]);

  useEffect(() => {
    async function onMount() {
      await updateBalance();

      setRewards('');
      setMinAmountOut(0);

      // only allow selling for FRAX if we are out of IV swap territory
      if (
        templePrice >
        iv * ENV_VARS.VITE_PUBLIC_FRAX_SELL_DISABLED_IV_MULTIPLE
      ) {
        setIsFraxHidden(false);
      }

      await updateTemplePrice(selectedToken.address);
    }

    onMount();
  }, []);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>
          {small
            ? `EXCHANGE ${TICKER_SYMBOL.TEMPLE_TOKEN} FOR ${selectedToken.symbol}`
            : 'ARE YOU SURE, TEMPLAR?'}
        </ConvoFlowTitle>
      </TitleWrapper>
      <Input
        small={small}
        hint={`Balance: ${formatNumber(templeWalletAmount)}`}
        onHintClick={() =>
          copyBalance(templeWalletAmount, handleUpdateTempleAmount)
        }
        crypto={{ kind: 'value', value: TICKER_SYMBOL.TEMPLE_TOKEN }}
        max={templeWalletAmount}
        min={0}
        value={templeAmount}
        handleChange={
          ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
            ? noop
            : handleUpdateTempleAmount
        }
        placeholder={'0.00'}
        isNumber
        pairTop
      />
      <SwapArrows onClick={onSwapArrowClick} small={small} />
      <Input
        small={small}
        hint={`Balance: ${formatNumber(stableCoinWalletAmount)}`}
        crypto={
          isFraxHidden
            ? {
                kind: 'value',
                value: selectedToken.symbol,
              }
            : {
                kind: 'select',
                cryptoOptions: dropdownOptions,
                onCryptoChange: (e) => {
                  setSelectedToken({
                    address: e.value.toString(),
                    symbol: e.label as TICKER_SYMBOL,
                  });
                },
                defaultValue: dropdownOptions[0],
              }
        }
        isNumber
        value={formatNumber(rewards as number)}
        placeholder={'0.00'}
        disabled
        pairBottom
      />
      <Slippage
        label={`${TICKER_SYMBOL.TEMPLE_TOKEN}: (${formatNumber(templePrice)})`}
        value={slippage}
        onChange={
          ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
            ? noop
            : handleUpdateSlippageForSell
        }
      />
      <Spacer small={small} />
      <Button
        isSmall={small}
        label={
          minAmountOut > rewards
            ? 'increase slippage'
            : `${
                small
                  ? `EXCHANGE ${TICKER_SYMBOL.TEMPLE_TOKEN} FOR ${selectedToken.symbol}`
                  : `RENOUNCE YOUR ${TICKER_SYMBOL.TEMPLE_TOKEN}`
              }`
        }
        isUppercase
        onClick={
          ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
            ? noop
            : handleSurrenderTemple
        }
        disabled={
          ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true' ||
          templeAmount == 0 ||
          templeAmount == '' ||
          templeAmount > templeWalletAmount
        }
      />
      {selectedToken.symbol === TICKER_SYMBOL.STABLE_TOKEN && (
        <SellInfo>
          <p>
            TempleDAO will use $FEI instead of $FRAX for Temple Defense at 1:1
          </p>
          <Tooltip
            content={`If this transaction causes the ${TICKER_SYMBOL.TEMPLE_TOKEN} AMM to defend its intrinsic value price by burning ${TICKER_SYMBOL.TEMPLE_TOKEN}, you will receive ${TICKER_SYMBOL.FEI} for this sale.`}
          >
            <TooltipIcon />
          </Tooltip>
        </SellInfo>
      )}
    </ViewContainer>
  );
};

const SellInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: center;
  max-width: ${400 / 16}rem;
  margin: auto;
  color: ${({ theme }) => theme.palette.brandLight};
  p {
    font-size: 1rem;
  }
`;
