import React, { FC, useEffect, useState } from 'react';
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
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { noop } from 'utils/helpers';
import { STABLE_COIN_ADDRESS, FEI_ADDRESS } from 'providers/env';

interface SizeProps {
  small?: boolean;
}
interface BuyProps extends SizeProps {
  onSwapArrowClick: () => void;
}

const ENV_VARS = import.meta.env;

const defaultOption = {
  label: TICKER_SYMBOL.FEI,
  value: FEI_ADDRESS,
};

export const Sell: FC<BuyProps> = ({ onSwapArrowClick, small }) => {
  const { balance, getBalance, updateBalance } = useWallet();
  const { sell, getSellQuote, templePrice, updateTemplePrice, iv, updateIv } =
    useSwap();

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
  const [options, setOptions] = useState([defaultOption]);

  const isIvSwap = (quote: BigNumber | void, value: number) =>
    !!quote && fromAtto(quote) < value * iv;

  const handleUpdateTempleAmount = async (value: number | '') => {
    setTempleAmount(value === 0 ? '' : value);
    if (value) {
      const sellQuote = await getSellQuote(toAtto(value));

      // if this sell is going to IVSwap, remove FRAX from the dropdown and select FEI
      if (isIvSwap(sellQuote, value) && options[1]) {
        setSelectedToken({
          symbol: defaultOption.label,
          address: defaultOption.value,
        });
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

        const sellQuote = await getSellQuote(toAtto(templeAmount));

        if (minAmountOut <= rewards || isIvSwap) {
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
    const setBalanceState = () => {
      setTempleWalletAmount(balance.temple);
      if (selectedToken.symbol === TICKER_SYMBOL.FEI) {
        setStableCoinWalletAmount(balance.fei);
      } else {
        setStableCoinWalletAmount(balance.stableCoin);
      }
    };
    if (balance) {
      setBalanceState();
    }
  }, [balance, selectedToken]);

  useEffect(() => {
    async function onMount() {
      await updateBalance();
      await updateTemplePrice();
      await updateIv();
      setRewards('');
      setMinAmountOut(0);

      // only allow selling for FRAX if we are out of IV swap territory
      if (templePrice > iv * 1.02) {
        setOptions([
          defaultOption,
          {
            label: TICKER_SYMBOL.STABLE_TOKEN,
            value: STABLE_COIN_ADDRESS,
          },
        ]);
      }
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
        crypto={{
          kind: 'select',
          cryptoOptions: options,
          onCryptoChange: (e) =>
            setSelectedToken({
              address: e.value.toString(),
              symbol: e.label as TICKER_SYMBOL,
            }),
          defaultValue: defaultOption,
        }}
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
    </ViewContainer>
  );
};
