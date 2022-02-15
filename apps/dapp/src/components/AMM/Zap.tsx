import React, { useState, useEffect } from 'react';

import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { InputSelect } from 'components/InputSelect/InputSelect';
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
import { TempleZaps__factory } from 'types/typechain';
import { ethers } from 'ethers';

export const Zap = () => {
  const { signer, balance, getBalance, zapIn } = useWallet();
  const [ethBalance, setEthBalance] = useState(0);
  const [tokenAmount, setTokenAmount] = useState('0');
  const [zapped, setZapped] = useState(false);

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
          setTokenAmount(e.target.value);
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
