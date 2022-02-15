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
import { BigNumber, ethers, Signer } from 'ethers';
import axios from 'axios';

export const Zap = () => {
  const ENV_VARS = import.meta.env;
  const ZEROEX_EXCHANGE_PROXY = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';
  const ZEROEX_QUOTE_ENDPOINT = 'https://api.0x.org/swap/v1/quote?';
  const FRAX = '0x853d955aCEf822Db058eb8505911ED77F175b99e';
  const { wallet, signer, balance } = useWallet();
  const [ethBalance, setEthBalance] = useState(0);

  //TODO: add to balance in walletprovider
  const getEthBalance = async () => {
    if (signer) {
      const ethBal = await signer.getBalance();
      setEthBalance(fromAtto(ethBal));
    } else setEthBalance(0);
  };

  useEffect(() => {
    getEthBalance();
    if(signer){
      const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();
    }
  }, []);

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

      <Button isSmall label={'ZAP AND STAKE'} />
    </ViewContainer>
  );
};

