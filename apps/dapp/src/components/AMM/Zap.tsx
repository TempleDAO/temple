import React, { useState, useEffect } from 'react';

import {
  IZapperTokenData,
  TEMPLE_TOKEN,
  useWallet,
} from 'providers/WalletProvider';

import { formatNumberWithCommas } from 'utils/formatter';
import { toAtto } from 'utils/bigNumber';

import useIsMounted from 'hooks/use-is-mounted';

import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { InputSelect } from 'components/InputSelect/InputSelect';
import Slippage from 'components/Slippage/Slippage';

import {
  ConvoFlowTitle,
  Spacer,
  TitleWrapper,
  TooltipPadding,
  ViewContainer,
} from './helpers/components';

export const Zap = () => {
  const {
    signer,
    wallet,
    getZapQuote,
    balance,
    getBalance,
    getTokenBalance,
    tokensInWallet,
    getWalletTokenBalances,
    zapIn,
  } = useWallet();

  const isMounted = useIsMounted();

  const [tokenAmount, setTokenAmount] = useState<number | ''>('');
  const [zapping, setZapping] = useState(false);
  const [slippage, setSlippage] = useState(5);
  const [templeQuote, setTempleQuote] = useState(0);
  const [selectedToken, setSelectedToken] = useState<IZapperTokenData>(
    tokensInWallet[0]
  );
  const [tokenBalance, setTokenBalance] = useState(0);

  const handleClick = async (tokenAmount: number) => {
    setZapping(true);
    // quoted temple * slippage as a percentage
    // e.g. for 5% slippage, 100 TEMPLE * 0.95 = 95 min recieved
    const minTempleRecieved = templeQuote * (1 - slippage / 100);
    console.log(minTempleRecieved)
    console.log(templeQuote)
    console.log(slippage)
    console.log(1 - slippage)
    console.log(1 - slippage / 100)
    if (signer && wallet) {
      await zapIn(
        signer,
        wallet,
        selectedToken.symbol,
        selectedToken.address,
        selectedToken.decimals,
        tokenAmount,
        toAtto(minTempleRecieved)
      );
    }

    if (!isMounted.current) {
      return;
    }

    setZapping(false);

    await updateTokenBalance(selectedToken.address, selectedToken.decimals);
  };

  const handleInput = async (value: string) => {
    if (!!value) {
      setTokenAmount(Number(value));
      const quote = await getZapQuote(selectedToken.price, Number(value));

      if (!isMounted.current) {
        return;
      }

      if (quote) {
        setTempleQuote(quote);
      }
    } else {
      setTokenAmount(0);
      setTempleQuote(0);
    }
  };

  const updateTokenBalance = async (
    tokenAddr: string,
    decimals: number,
    fallbackBalance?: number
  ) => {
    if (signer && wallet) {
      const balance = await getTokenBalance(tokenAddr, decimals);

      if (!isMounted.current) {
        return;
      }

      if (balance) {
        setTokenBalance(balance);
      } else {
        fallbackBalance && setTokenBalance(fallbackBalance);
      }
    }
  };

  useEffect(() => {
    getWalletTokenBalances();
    getBalance();
    updateTokenBalance(selectedToken.address, selectedToken.decimals);
  }, [zapping]);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>ZAP ASSETS TO {TEMPLE_TOKEN}</ConvoFlowTitle>
        <TooltipPadding>
          <Tooltip
            content={
              <small>
                {`Get ${TEMPLE_TOKEN} in a single transaction with any ERC20 token.`}
              </small>
            }
            position={'top'}
          >
            <TooltipIcon />
          </Tooltip>
        </TooltipPadding>
      </TitleWrapper>

      <InputSelect
        options={tokensInWallet.map((token) => {
          return {
            value: token.address,
            label: `$${token.symbol}`,
          };
        })}
        onChange={(e) => {
          const token = tokensInWallet.find(
            ({ address }) => address === e.value
          );
          if (!token) {
            return;
          }
          setSelectedToken(token);
          setTokenAmount(0);
          updateTokenBalance(token.address, token.decimals, token.balance);
        }}
        defaultValue={{
          value: tokensInWallet[0].address,
          label: tokensInWallet[0].symbol,
        }}
      />

      <Input
        small
        crypto={{ kind: 'value', value: `$${selectedToken.symbol}` }}
        hint={`Balance: ${formatNumberWithCommas(tokenBalance)}`}
        onHintClick={() => {
          handleInput(`${tokenBalance}`);
        }}
        type={'number'}
        placeholder={'0.00'}
        value={tokenAmount}
        onChange={(e) => {
          handleInput(e.target.value);
        }}
        disabled={selectedToken.symbol === 'TOKEN'}
      />

      <Input
        small
        isNumber
        disabled
        crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
        hint={`Balance: ${formatNumberWithCommas(balance.temple)}`}
        placeholder={'0.00'}
        value={formatNumberWithCommas(templeQuote)}
      />

      <Slippage
        value={slippage}
        onChange={(value) => {
          setSlippage(value);
        }}
      />

      <Spacer small />

      <Button
        isSmall
        label={
          zapping
            ? 'ZAPPING'
            : `ZAP $${selectedToken.symbol} TO ${TEMPLE_TOKEN}`
        }
        onClick={() => handleClick(Number(tokenAmount))}
        disabled={
          zapping ||
          !tokenAmount ||
          tokenAmount > selectedToken.balance ||
          selectedToken.balance === 0
        }
      />
    </ViewContainer>
  );
};
