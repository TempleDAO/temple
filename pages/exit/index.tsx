import Image from 'next/image';
import React, { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Flex } from '../../components/Layout/Flex';
import { Tabs } from '../../components/Tabs/Tabs';
import { useWallet } from '../../providers/WalletProvider';
import BuyImage from '../../public/images/buy-art.svg';

enum PageTabs {
  EXIT = 'exit',
  COLLECT = 'collect',
}

/* TODO: Consider Formik to handle form */
const Exit = () => {
  /* TODO: get data */
  const [withdrawalAmount, setWithdrawalAmount] = useState<number>(0);
  const [withdrawalAllowance, setWithdrawalAllowance] = useState<number>(0);
  const { exchangeRate, templeApy, treasury } = useWallet();


  const handleWithdrawalAmountUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    let x = +value;
    setWithdrawalAmount(x);
  };

  const handleWithdrawal = async () => {
    try {
      /* TODO: implement */
      // await withdrawal(withdrawalAmount);
    } catch (e) {
      console.info(e);
    }
  };

  const getTabs = () => {
    return [
      {
        label: PageTabs.EXIT,
        disabledMessage: 'This Chamber will open after the completion of the Fire Ceremony',
        content: <>
          <Input hint={`Balance: ${withdrawalAllowance}`}
                 crypto={
                   {
                     kind: 'value',
                     value: 'TEMPLE'
                   }}
                 type={'number'}
                 max={withdrawalAllowance}
                 min={0}
                 value={withdrawalAmount}
                 onChange={handleWithdrawalAmountUpdate}
                 placeholder={'0.00'}
          />
          <Button label={'Join Queue'} onClick={handleWithdrawal}/>
          <p>
            Queue is currently full to block XXXXX.
            <br/>
            Queue is processed fairly in sequence of exit requests.
          </p>
        </>
      },
      {
        label: PageTabs.COLLECT,
        disabledMessage: 'This Chamber will open after the completion of the Fire Ceremony',
        content: <>
          <h4 className={'margin-remove'}>Your queue progress on XXXX $TEMPLE:</h4>
          <pre>TODO: bar for queue progress!</pre>
          <Button label={'Collect'} onChange={() => {
          }}/>
          <p>
            Your $TEMPLE will be fully processed by block XXX.
            I change my mind. <a href={'#'}>Cancel</a> my exit queue and resume staking.
          </p>
        </>
      },
    ];
  };

  return (
      <>
        <h1>Why would you leave the Temple?</h1>
        <Flex layout={{
          kind: 'container',
          canWrap: true,
          canWrapTablet: false,
        }}>
          <Flex layout={{
            kind: 'item',
            col: 'fullwidth',
            colTablet: 'half',
          }}>
            <Tabs tabs={getTabs()}/>
          </Flex>
          <Flex layout={{
            kind: 'item',
            col: 'fullwidth',
            colTablet: 'half',
            alignItems: 'flex-start',
          }}>
            <Image src={BuyImage} alt={'Buy art'}/>
          </Flex>
        </Flex>
      </>
  );
};

export default Exit;
