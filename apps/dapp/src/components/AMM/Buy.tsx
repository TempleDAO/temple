import React, { FC, useEffect, useState, useCallback } from 'react';
import { BigNumber } from 'ethers';
import { Input } from 'components/Input/Input';
import { formatNumber } from 'utils/formatter';
import {
  ConvoFlowTitle,
  Spacer,
  SwapArrows,
  TitleWrapper,
  ViewContainer,
} from 'components/AMM/helpers/components';
import { copyBalance } from 'components/AMM/helpers/methods';
import Slippage from 'components/Slippage/Slippage';
import { Button } from 'components/Button/Button';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { noop } from 'utils/helpers';

interface BuyProps {
  small?: boolean;
  onSwapArrowClick: () => void;
}

const ENV_VARS = import.meta.env;

export const Buy: FC<BuyProps> = ({ onSwapArrowClick, small }) => {
  const { balance, getBalance, updateBalance } = useWallet();
  const { buy, getBuyQuote, templePrice } = useSwap();

  const [stableCoinAmount, setStableCoinAmount] = useState<number | ''>('');
  const [stableCoinWalletAmount, setStableCoinWalletAmount] =
    useState<number>(0);
  const [rewards, setRewards] = useState<number | ''>('');
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(0);
  const [slippage, setSlippage] = useState<number>(1);
  const [minAmountOut, setMinAmountOut] = useState<number>(0);

  const handleUpdateStableCoinAmount = async (value: number | '') => {
    setStableCoinAmount(value === 0 ? '' : value);
    if (value) {
      setRewards(
        fromAtto((await getBuyQuote(toAtto(value))) || BigNumber.from(0) || 0)
      );
    } else {
      setRewards('');
    }
  };

  const handleUpdateSlippageForBuy = async (value: number) => {
    setSlippage(value);
  };

  const handleSacrificeStableCoin = async () => {
    try {
      if (stableCoinAmount) {
        const minAmountOut =
          (stableCoinAmount / templePrice) * (1 - slippage / 100);
        setMinAmountOut(minAmountOut);
        if (minAmountOut <= rewards) {
          await buy(toAtto(stableCoinAmount), toAtto(minAmountOut));
          getBalance();
          handleUpdateStableCoinAmount('');
        }
      }
    } catch (e) {
      console.info(e);
    }
  };

  useEffect(() => {
    if (balance) {
      setStableCoinWalletAmount(balance.stableCoin);
      setTempleWalletAmount(balance.temple);
    }
  }, [balance]);

  useEffect(() => {
    async function onMount() {
      await updateBalance();
      setRewards('');
      setMinAmountOut(0);
    }

    onMount();
  }, []);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>
          {small
            ? 'EXCHANGE $FRAX FOR $TEMPLE'
            : 'HOW DEDICATED ARE YOU, TEMPLAR?'}
        </ConvoFlowTitle>
      </TitleWrapper>
      <Input
        small={small}
        hint={`Balance: ${formatNumber(stableCoinWalletAmount)}`}
        onHintClick={() =>
          copyBalance(stableCoinWalletAmount, handleUpdateStableCoinAmount)
        }
        crypto={{ kind: 'value', value: TICKER_SYMBOL.FRAX }}
        isNumber
        max={stableCoinWalletAmount}
        min={0}
        value={stableCoinAmount}
        handleChange={
          ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
            ? noop
            : handleUpdateStableCoinAmount
        }
        placeholder={'0.00'}
        pairTop
      />
      <SwapArrows small={small} onClick={onSwapArrowClick} />
      <Input
        small={small}
        hint={`Balance: ${formatNumber(templeWalletAmount)}`}
        crypto={{ kind: 'value', value: TICKER_SYMBOL.TEMPLE_TOKEN }}
        type={'number'}
        value={formatNumber(rewards as number)}
        placeholder={'0.00'}
        isNumber
        disabled
        pairBottom
      />
      <Slippage
        label={`${TICKER_SYMBOL.TEMPLE_TOKEN}: (${formatNumber(templePrice)})`}
        value={slippage}
        onChange={
          ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
            ? noop
            : handleUpdateSlippageForBuy
        }
      />
      <Spacer small={small} />
      <Button
        label={
          minAmountOut > rewards
            ? 'increase slippage'
            : `${
                small
                  ? 'EXCHANGE $FRAX FOR $TEMPLE'
                  : `sacrifice ${TICKER_SYMBOL.FRAX}`
              } `
        }
        isUppercase
        isSmall={small}
        onClick={
          ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true'
            ? noop
            : handleSacrificeStableCoin
        }
        disabled={
          ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true' ||
          stableCoinAmount == 0 ||
          stableCoinWalletAmount == 0 ||
          stableCoinAmount > stableCoinWalletAmount
        }
      />
    </ViewContainer>
  );
};
