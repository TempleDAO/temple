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
  const { signer, wallet, balance, getBalance, zapIn, getTokenPriceInFrax } =
    useWallet();
  const treasuryMetrics = useRefreshableTreasuryMetrics();
  const [tokensInWallet, setTokensInWallet] = useState<IToken[]>([]);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tokenAmount, setTokenAmount] = useState('0');
  const [zapped, setZapped] = useState(false);
  const [tokenPrice, setTokenPrice] = useState(0);
  const [templeQuote, setTempleQuote] = useState(0);
  const [selectedToken, setSelectedToken] = useState<IToken>({
    symbol: 'ETH',
    address: ethers.constants.AddressZero,
    balance: 0,
    price: 0,
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

  //TODO: add to balance in walletprovider
  /*   const getEthBalance = async () => {
    if (signer) {
      const ethBal = await signer.getBalance();
      setTokenBalance(fromAtto(ethBal));
    } else setTokenBalance(0);
  }; */

  const handleClick = (address: string, tokenAmount: string) => {
    setZapped(false);
    zapIn(address, tokenAmount, toAtto(1).toString()).then((res) => {
      setZapped(true);
    });
  };

  const handleInput = async (value: string) => {
    if (value !== '') {
      setTokenAmount(value);
      // TODO: Replace hardcoded 0.7 with actual TEMPLE price
      //       once treasuryMetrics is working on this branch
      setTempleQuote((selectedToken.price * parseFloat(value)) / 0.7);
    } else {
      setTokenAmount('0');
      setTempleQuote(0);
    }
  };

  const getQuote = async () => {
    const priceInFrax = await getTokenPriceInFrax(selectedToken.symbol);
    if (priceInFrax) {
      setTokenPrice(priceInFrax);
    } else setTokenPrice(0);
  };

  useEffect(() => {
    getWalletTokenBalances();
    getQuote();
    //getEthBalance();
    getBalance();
  }, [zapped]);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>ZAP ASSETS FOR {TEMPLE_TOKEN}</ConvoFlowTitle>
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
          getQuote();
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
        label={`ZAP ${selectedToken.symbol} FOR ${TEMPLE_TOKEN}`}
        onClick={() => handleClick(ethers.constants.AddressZero, tokenAmount)}
      />
    </ViewContainer>
  );
};
