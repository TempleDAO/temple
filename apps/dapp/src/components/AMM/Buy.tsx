import { Input } from 'components/Input/Input';
import { BigNumber } from 'ethers';
import React, { FC, useEffect, useState } from 'react';
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
import { STABLE_COIN_SYMBOL } from 'components/Pages/Rituals';
import { TEMPLE_TOKEN, useWallet } from 'providers/WalletProvider';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { noop } from 'utils/helpers';

interface BuyProps {
  small?: boolean;
  onSwapArrowClick: () => void;
}

const ENV_VARS = import.meta.env;

export const Buy: FC<BuyProps> = ({ onSwapArrowClick, small }) => {
  const { balance, getBalance, updateWallet, buy, getBuyQuote, templePrice } =
    useWallet();

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
      await updateWallet();
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
        crypto={{ kind: 'value', value: STABLE_COIN_SYMBOL }}
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
        crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
        type={'number'}
        value={formatNumber(rewards as number)}
        placeholder={'0.00'}
        isNumber
        disabled
        pairBottom
      />
      <Slippage
        label={`${TEMPLE_TOKEN}: (${formatNumber(templePrice)})`}
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
                  : `sacrifice ${STABLE_COIN_SYMBOL}`
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
          stableCoinWalletAmount == 0
        }
      />
    </ViewContainer>
  );
};
