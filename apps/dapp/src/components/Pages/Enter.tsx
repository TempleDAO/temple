//@ts-nocheck
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import Image from 'components/Image/Image';
import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { SelectTempleDaoOptions } from 'components/InputSelect/InputSelect';
import { Flex } from 'components/Layout/Flex';
import { Tab, Tabs } from 'components/Tabs/Tabs';
import { useWallet } from 'providers/WalletProvider';
import BuyImage from 'assets/images/buy-art.svg';

/* TODO: Consider Formik to handle form */
const Enter = () => {
  /* TODO: get data */
  // temple amount in the user wallet
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(0);
  // temple amount from user input in the UI
  const [templeAmount, setTempleAmount] = useState<number>(0);
  // crypto(FRAX,...) amount in the user wallet
  const [cryptoWalletAmount, setCryptoWalletAmount] = useState<number>(0);
  // crypto(FRAX,...) amount from user input in the UI
  const [cryptoAmount, setCryptoAmount] = useState<number>(0);
  // has the value of the current tab buy | stake
  const [activeTab, setActiveTab] = useState<string>('');
  const { updateWallet, balance, buy, stake, exchangeRate } = useWallet();

  useEffect(() => {
    const loadBalance = async () => {
      const b = await updateWallet();
      if (balance) {
        if (activeTab === 'buy') {
          setCryptoWalletAmount(balance.stableCoin);
          setTempleWalletAmount(balance.temple);
          setCryptoAmount(balance.stableCoin);
        }
        if (activeTab === 'stake') {
          setCryptoWalletAmount(balance.stableCoin);
          setTempleWalletAmount(balance.temple);
          setTempleAmount(balance.temple);
        }
      }
    };
    loadBalance().then();
  }, [activeTab]);

  const handleBuy = async () => {
    try {
      await buy(cryptoAmount);
    } catch (e) {
      console.info(e);
    }
  };

  const handleStake = async () => {
    try {
      await stake(templeAmount);
    } catch (e) {
      console.info(e);
    }
  };

  const getAvailableCryptoOptions = (): SelectTempleDaoOptions => {
    /* TODO: Call web3.[getAvailableCrypto]!!! ? */
    /* TODO: Transform to SelectOptions */
    return [
      {
        value: 'FRAX',
        label: 'FRAX',
      },
    ];
  };

  const handleUpdateBuyTemple = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    const x = +value;
    setTempleAmount(x);
    /* TODO: get rules for calculations */
    setCryptoAmount(x * exchangeRate);
  };

  const handleUpdateCrypto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const x = +value;
    setCryptoAmount(x);
    /* TODO: get rules for calculations */
    setTempleAmount(x / exchangeRate);
  };

  const handleUpdateStakeTemple = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setTempleAmount(+value);
  };

  const getExpectedBalance = (type: 'temple' | 'crypto') => {
    /* TODO: get rules for calculations */
    switch (type) {
      case 'temple':
        return templeWalletAmount;
      case 'crypto':
        return cryptoWalletAmount;
      default:
        return 0;
    }
  };

  const getTabs = (): Array<Tab> => {
    const availableCryptoOptions = getAvailableCryptoOptions();
    return [
      {
        label: 'buy',
        disabledMessage: 'This Chamber will open soon',
        content: (
          <>
            <Input
              hint={`Balance: ${getExpectedBalance('temple')}`}
              crypto={{ kind: 'value', value: '$TEMPLE' }}
              placeholder={'0.00'}
              value={templeAmount}
              type={'number'}
              min={0}
              onChange={handleUpdateBuyTemple}
            />
            <Input
              hint={`Balance: ${getExpectedBalance('crypto')}`}
              crypto={{
                kind: 'select',
                cryptoOptions: availableCryptoOptions,
                defaultValue: availableCryptoOptions[0],
              }}
              type={'number'}
              max={cryptoWalletAmount}
              min={0}
              value={cryptoAmount}
              onChange={handleUpdateCrypto}
              placeholder={'0.00'}
            />
            <Button label={'Purchase'} onClick={handleBuy} />
            <pre>
              DEBUG:
              {JSON.stringify(balance, null, 2)}
            </pre>
            <p>
              Mint price capped at fair premium on $TEMPLE intrinsic value.
              <br />
              <a href="#">Buy from AMM</a> when cheaper $TEMPLE on AMM is $X.
            </p>
          </>
        ),
      },
      {
        label: 'stake',
        disabledMessage: 'This Chamber will open soon',
        content: (
          <>
            <Input
              hint={`Balance: ${getExpectedBalance('temple')}`}
              crypto={{ kind: 'value', value: '$TEMPLE' }}
              type={'number'}
              max={templeWalletAmount}
              min={0}
              value={templeAmount}
              onChange={handleUpdateStakeTemple}
              placeholder={'0.00'}
            />
            <Button label={'Stake'} onClick={handleStake} />
            <p>
              Mint price capped at fair premium on $TEMPLE intrinsic value.
              <br />
              <a href="#">Buy from AMM</a> when cheaper $TEMPLE on AMM is $X.
            </p>
          </>
        ),
      },
    ];
  };

  return (
    <>
      <h1>Temple Entrance</h1>
      <Flex
        layout={{
          kind: 'container',
          canWrap: true,
          canWrapTablet: false,
        }}
      >
        <Flex
          layout={{
            kind: 'item',
            col: 'fullwidth',
            colTablet: 'half',
          }}
        >
          <Tabs tabs={getTabs()} onChange={setActiveTab} />
        </Flex>
        <Flex
          layout={{
            kind: 'item',
            col: 'fullwidth',
            colTablet: 'half',
            alignItems: 'flex-start',
          }}
        >
          <Image src={BuyImage} alt={'Buy art'} fillContainer />
        </Flex>
      </Flex>
    </>
  );
};

export default Enter;
