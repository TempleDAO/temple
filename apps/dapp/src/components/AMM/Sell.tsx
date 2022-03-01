import { Input } from 'components/Input/Input';
import { BigNumber } from 'ethers';
import React, { FC, useEffect, useState } from 'react';
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
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { noop } from 'utils/helpers';

interface SizeProps {
  small?: boolean;
}
interface BuyProps extends SizeProps {
  onSwapArrowClick: () => void;
}

const ENV_VARS = import.meta.env;

export const Sell: FC<BuyProps> = ({ onSwapArrowClick, small }) => {
  const { balance, getBalance, updateWallet, sell, getSellQuote, templePrice } =
    useWallet();

  const [stableCoinWalletAmount, setStableCoinWalletAmount] =
    useState<number>(0);
  const [rewards, setRewards] = useState<number | ''>('');
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(0);
  const [slippage, setSlippage] = useState<number>(1);
  const [minAmountOut, setMinAmountOut] = useState<number>(0);
  const [templeAmount, setTempleAmount] = useState<number | ''>('');

  const handleUpdateTempleAmount = async (value: number | '') => {
    setTempleAmount(value === 0 ? '' : value);
    if (value) {
      setRewards(
        fromAtto((await getSellQuote(toAtto(value))) || BigNumber.from(0) || 0)
      );
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
        if (minAmountOut <= rewards) {
          await sell(toAtto(templeAmount), toAtto(minAmountOut));
          getBalance();
          handleUpdateTempleAmount(0);
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
          {small ? 'EXCHANGE $TEMPLE FOR $FRAX' : 'ARE YOU SURE, TEMPLAR?'}
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
      <SwapArrows onClick={onSwapArrowClick} small />
      <Input
        small={small}
        hint={`Balance: ${formatNumber(stableCoinWalletAmount)}`}
        crypto={{ kind: 'value', value: TICKER_SYMBOL.STABLE_TOKEN }}
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
                  ? 'EXCHANGE $TEMPLE FOR $FRAX'
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
    </ViewContainer>
  );
};
