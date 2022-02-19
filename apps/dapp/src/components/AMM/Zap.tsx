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
import useRefreshableTreasuryMetrics from 'hooks/use-refreshable-treasury-metrics';
import axios from 'axios';
import { InputSelect } from 'components/InputSelect/InputSelect';

interface IZapperAPIResponse {
  address: string;
  balance: number;
  balanceRaw: string;
  balanceUSD: number;
  decimals: number;
  network: string;
  price: number;
  symbol: string;
  type: string;
}

interface IToken {
  symbol: string;
  address: string;
  balance: number;
  price: number;
}

export const Zap = () => {
  const { signer, wallet, balance, getBalance, zapIn } =
    useWallet();
  const treasuryMetrics = useRefreshableTreasuryMetrics();
  const [tokensInWallet, setTokensInWallet] = useState<IToken[]>([]);
  const [tokenAmount, setTokenAmount] = useState(0);
  const [zapped, setZapped] = useState(false);
  const [templeQuote, setTempleQuote] = useState(0);
  // TODO: setup null state for selectedToken
  const [selectedToken, setSelectedToken] = useState<IToken>({
    symbol: 'FRAX',
    address: '0x853d955aCEf822Db058eb8505911ED77F175b99e',
    balance: 0,
    price: 0.99,
  });

  const getWalletTokenBalances = async () => {
    if (wallet && signer) {
      const PUBLIC_ZAPPER_API_KEY = '96e0cc51-a62e-42ca-acee-910ea7d2a241';
      const res = await axios.get(
        `https://api.zapper.fi/v1/protocols/tokens/balances?addresses[]=${wallet}&api_key=${PUBLIC_ZAPPER_API_KEY}`
      );
      if (res) {
        //@ts-ignore
        const tokenResponse: IZapperAPIResponse[] = Object.values(res.data)[0]
          .products[0].assets;

        const tokenArr: IToken[] = [];

        tokenResponse.forEach((token) => {
          if (token.network === 'ethereum') {
            tokenArr.push({
              symbol: token.symbol,
              address: token.address,
              balance: token.balance,
              price: token.price,
            });
          }
        });
        setTokensInWallet(tokenArr);
      }
    }
  };

  const handleClick = async (address: string, tokenAmount: number) => {
    setZapped(false);
    await zapIn(
      selectedToken.symbol,
      selectedToken.address,
      tokenAmount.toString(),
      toAtto(1).toString()
    );
    setZapped(true);
  };

  const handleInput = async (value: string) => {
    if (value !== '') {
      setTokenAmount(Number(value));
      // TODO: Replace hardcoded 0.7 with actual TEMPLE price
      //       once treasuryMetrics is working on this branch
      setTempleQuote((selectedToken.price * parseFloat(value)) / 0.7);
    } else {
      setTokenAmount(0);
      setTempleQuote(0);
    }
  };

  useEffect(() => {
    getWalletTokenBalances();
    getBalance();
  }, [zapped]);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>ZAP ASSETS TO {TEMPLE_TOKEN}</ConvoFlowTitle>
      </TitleWrapper>

      <InputSelect
        options={tokensInWallet.map((token) => {
          return {
            value: token.address,
            label: token.symbol,
          };
        })}
        onChange={(e) => {
          tokensInWallet.forEach((token) => {
            if (token.symbol === e.label) {
              setSelectedToken(token);
            }
          });
        }}
      />

      <Input
        small
        isNumber
        crypto={{ kind: 'value', value: selectedToken.symbol }}
        hint={`Balance: ${formatNumberWithCommas(selectedToken.balance)}`}
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
        label={`ZAP ${selectedToken.symbol} TO ${TEMPLE_TOKEN}`}
        onClick={() => handleClick(ethers.constants.AddressZero, tokenAmount)}
        
      />
    </ViewContainer>
  );
};
