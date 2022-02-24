import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { constants, ethers } from 'ethers';

import {
  IZapperTokenData,
  TEMPLE_TOKEN,
  useWallet,
} from 'providers/WalletProvider';

import { formatNumberWithCommas } from 'utils/formatter';
import { toAtto } from 'utils/bigNumber';

import useRefreshableTreasuryMetrics from 'hooks/use-refreshable-treasury-metrics';

import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { InputSelect } from 'components/InputSelect/InputSelect';
import Slippage from 'components/Slippage/Slippage';

import {
  ConvoFlowTitle,
  Spacer,
  TitleWrapper,
  ViewContainer,
} from './helpers/components';

export const Zap = () => {
  const {
    templePrice,
    balance,
    getBalance,
    tokensInWallet,
    getWalletTokenBalances,
    zapIn,
  } = useWallet();

  const [tokenAmount, setTokenAmount] = useState(0);
  const [zapping, setZapping] = useState(false);
  const [slippage, setSlippage] = useState(5);
  const [templeQuote, setTempleQuote] = useState(0);
  const [selectedToken, setSelectedToken] = useState<IZapperTokenData>(
    tokensInWallet[0]
  );

  const handleClick = async (address: string, tokenAmount: number) => {
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
  };

  const handleInput = async (value: string) => {
    if (value !== '') {
      setTokenAmount(Number(value));
      setTempleQuote((selectedToken.price * parseFloat(value)) / templePrice);
    } else {
      setTokenAmount(0);
      setTempleQuote(0);
    }
  };

  useEffect(() => {
    getWalletTokenBalances();
    getBalance();
    setSelectedToken(tokensInWallet[0]);
  }, [zapping]);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>ZAP ASSETS TO {TEMPLE_TOKEN}</ConvoFlowTitle>
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
        isNumber
        crypto={{ kind: 'value', value: `$${selectedToken.symbol}` }}
        hint={`Balance: ${formatNumberWithCommas(selectedToken.balance)}`}
        placeholder={'0.00'}
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
        onClick={() => handleClick(ethers.constants.AddressZero, tokenAmount)}
        disabled={
          zapping ||
          tokenAmount === 0 ||
          tokenAmount > selectedToken.balance ||
          selectedToken.balance === 0
        }
      />
    </ViewContainer>
  );
};
