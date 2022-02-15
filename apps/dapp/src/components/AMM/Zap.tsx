import React, { useState, useEffect } from 'react';

import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import Slippage from 'components/Slippage/Slippage';
import { TEMPLE_TOKEN, useWallet } from 'providers/WalletProvider';

import {
  ConvoFlowTitle,
  Spacer,
  TitleWrapper,
  ViewContainer,
} from './helpers/components';
import { formatNumberWithCommas } from 'utils/formatter';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { ethers } from 'ethers';

export const Zap = () => {
  const { signer, balance, getBalance, zapIn, getZapQuote } = useWallet();
  const [ethBalance, setEthBalance] = useState(0);
  const [tokenAmount, setTokenAmount] = useState('0');
  const [zapped, setZapped] = useState(false);
  const [templeQuote, setTempleQuote] = useState(0);

  //TODO: add to balance in walletprovider
  const getEthBalance = async () => {
    if (signer) {
      const ethBal = await signer.getBalance();
      setEthBalance(fromAtto(ethBal));
    } else setEthBalance(0);
  };

  const handleClick = (address: string, tokenAmount: string) => {
    setZapped(false);
    zapIn(address, tokenAmount, toAtto(1).toString()).then((res) => {
      setZapped(true);
    });
  };

  const handleInput = async (value: string) => {
    setTokenAmount(value);
    if (value !== '') {
      const quote = await getZapQuote('ETH', value);
      quote && setTempleQuote(quote);
    } else setTempleQuote(0);
  };

  useEffect(() => {
    getEthBalance();
    getBalance();
  }, [zapped]);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>ZAP ASSETS FOR {TEMPLE_TOKEN}</ConvoFlowTitle>
      </TitleWrapper>

      <Input
        small
        isNumber
        crypto={{ kind: 'value', value: 'ETH' }}
        hint={`Balance: ${formatNumberWithCommas(ethBalance)}`}
        placeholder={'0.00'}
        onChange={(e) => {
          handleInput(e.target.value);
        }}
      />

      <Spacer small />

      <Input
        small
        isNumber
        disabled
        crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
        hint={`Balance: ${formatNumberWithCommas(balance.temple)}`}
        placeholder={'0.00'}
        value={formatNumberWithCommas(templeQuote)}
      />

      <Slippage value={3} onChange={() => console.log('slippage chaged')} />

      <Spacer small />

      <Button
        isSmall
        label={'ZAP AND STAKE'}
        onClick={() => handleClick(ethers.constants.AddressZero, tokenAmount)}
      />
    </ViewContainer>
  );
};
