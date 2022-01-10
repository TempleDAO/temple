import { Button } from 'components/Button/Button';
import { DataCard } from 'components/DataCard/DataCard';
import { Input } from 'components/Input/Input';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { TEMPLE_TOKEN, useWallet } from 'providers/WalletProvider';
import React, { FC, useEffect, useState } from 'react';
import { toAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
import {
  ConvoFlowTitle,
  TitleWrapper,
  TooltipPadding,
  ViewContainer,
  Spacer,
} from 'components/AMM/helpers/components';
import { copyBalance } from 'components/AMM/helpers/methods';

interface StakeProps {
  small?: boolean;
}

export const Stake: FC<StakeProps> = ({ small }) => {
  const { balance, getBalance, updateWallet, stake, apy } = useWallet();

  const [templeAmount, setTempleAmount] = useState<number | ''>('');
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(0);

  const handleUpdateTempleAmmount = async (value: number) => {
    setTempleAmount(value === 0 ? '' : value);
  };

  const handleTempleStake = async () => {
    try {
      if (templeAmount) {
        await stake(toAtto(templeAmount));
        getBalance();
      }
    } catch (e) {
      console.info(e);
    }
  };

  useEffect(() => {
    if (balance) {
      setTempleWalletAmount(balance.temple);
    }
  }, [balance]);

  useEffect(() => {
    async function onMount() {
      await updateWallet();
    }

    onMount();
  }, []);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>{`${
          small ? 'STAKE' : 'PLEDGE'
        } YOUR ${TEMPLE_TOKEN}`}</ConvoFlowTitle>
        <TooltipPadding>
          <Tooltip
            content={
              <small>
                {`You will receive $OGTEMPLE when you ${
                  small ? 'stake' : 'pledge'
                } your $TEMPLE to the
                staking contract`}
              </small>
            }
            position={'top'}
          >
            <TooltipIcon />
          </Tooltip>
        </TooltipPadding>
      </TitleWrapper>
      <Input
        small={small}
        hint={`Balance: ${formatNumber(templeWalletAmount)}`}
        onHintClick={() => copyBalance(templeWalletAmount, setTempleAmount)}
        crypto={{ kind: 'value', value: TEMPLE_TOKEN }}
        isNumber
        max={templeWalletAmount}
        min={0}
        value={templeAmount}
        handleChange={handleUpdateTempleAmmount}
        placeholder={'0.00'}
      />
      <DataCard
        title={`APY`}
        data={formatNumber(apy || 0) + '%'}
        small={small}
      />
      <Spacer small />
      <Button
        isSmall={small}
        label={small ? 'stake' : 'PLEDGE'}
        isUppercase
        onClick={handleTempleStake}
        disabled={templeAmount == 0 || templeAmount == ''}
      />
    </ViewContainer>
  );
};
