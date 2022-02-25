import React, { useState, useEffect } from 'react';

import {
  IZapperTokenData,
  TEMPLE_TOKEN,
  useWallet,
} from 'providers/WalletProvider';

import { formatNumberWithCommas } from 'utils/formatter';
import { toAtto } from 'utils/bigNumber';

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
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';

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
    const minTempleRecieved = templeQuote * (1 - slippage / 100);
    await zapIn(
      selectedToken.symbol,
      selectedToken.address,
      selectedToken.decimals,
      tokenAmount.toString(),
      toAtto(minTempleRecieved).toString()
    );
    setZapping(false);
    await updateTokenBalance(selectedToken.address, selectedToken.decimals);
  };

  const handleInput = async (value: string) => {
    if (value !== '') {
      setTokenAmount(Number(value));
      const quote = await getZapQuote(selectedToken.price, Number(value));
      if (quote) {
        setTempleQuote(quote);
      }
    } else {
      setTokenAmount(0);
      setTempleQuote(0);
    }
  };

  const updateTokenBalance = async (tokenAddr: string, decimals: number) => {
    if (signer && wallet) {
      const balance = await getTokenBalance(tokenAddr, decimals);
      if (balance) {
        setTokenBalance(balance);
      } else {
        setTokenBalance(selectedToken.balance);
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

      {tokensInWallet.length > 0 && (
        <InputSelect
          options={tokensInWallet.map((token) => {
            return {
              value: token.address,
              label: `$${token.symbol}`,
            };
          })}
          onChange={(e) => {
            tokensInWallet.forEach((token) => {
              if (token.address === e.value) {
                setSelectedToken(token);
                setTokenAmount(0);
                updateTokenBalance(token.address, token.decimals);
              }
            });
          }}
          defaultValue={{
            value: tokensInWallet[0].address,
            label: tokensInWallet[0].symbol,
          }}
        />
      )}

      <Input
        small
        crypto={{ kind: 'value', value: `$${selectedToken.symbol}` }}
        hint={`Balance: ${formatNumberWithCommas(tokenBalance)}`}
        onHintClick={() => {
          handleInput(`${selectedToken.balance}`);
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
          tokenAmount === 0 ||
          tokenAmount === '' ||
          tokenAmount > selectedToken.balance ||
          selectedToken.balance === 0
        }
      />
    </ViewContainer>
  );
};
