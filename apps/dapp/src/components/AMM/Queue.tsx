import React, { FC, useEffect, useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import { Flex } from 'components/Layout/Flex';
import { Button } from 'components/Button/Button';
import { DataCard } from 'components/DataCard/DataCard';
import { Input } from 'components/Input/Input';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import {
  JoinQueueData,
  OG_TEMPLE_TOKEN,
  RitualKind,
  useWallet,
} from 'providers/WalletProvider';
import { toAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
import {
  ConvoFlowTitle,
  Spacer,
  TitleWrapper,
  TooltipPadding,
  ViewContainer,
} from 'components/AMM/helpers/components';
import { copyBalance } from 'components/AMM/helpers/methods';


interface QueueProps {
  small?: boolean;
}

export const Queue: FC<QueueProps> = ({ small }) => {
  const {
    balance,
    getBalance,
    updateWallet,
    increaseAllowanceForRitual,
    getJoinQueueData,
    getRewardsForOGT,
  } = useWallet();
  const [OGTWalletAmount, setOGTWalletAmount] = useState<number>(0);
  const [OGTAmount, setOGTAmount] = useState<number | ''>('');
  const [joinQueueData, setJoinQueueData] = useState<JoinQueueData | null>({
    queueLength: 0,
    processTime: 0,
  });
  const [rewards, setRewards] = useState<number | ''>('');
  const repositionTopTooltip = useMediaQuery({ query: '(max-width: 1235px)' });
  const repositionProcessTimeTooltip = useMediaQuery({
    query: '(max-width: 970px)',
  });
  const isSmallOrMediumScreen = useMediaQuery({ query: '(max-width: 800px)' });

  const updateTempleRewards = async (ogtAmount: number) => {
    setRewards((await getRewardsForOGT(ogtAmount)) || 0);
  };

  const updateJoinQueueData = async (ogtAmount: number) => {
    setJoinQueueData(
      (await getJoinQueueData(toAtto(ogtAmount))) || {
        queueLength: 0,
        processTime: 0,
      }
    );
  };

  const handleUpdateOGT = (value: number | '') => {
    setOGTAmount(value === 0 ? '' : value);

    void updateTempleRewards(value === '' ? 0 : value);
    void updateJoinQueueData(value === '' ? 0 : value);
  };

  const handleUnlockOGT = async () => {
    try {
      if (OGTAmount) {
        await increaseAllowanceForRitual(
          toAtto(OGTAmount),
          RitualKind.OGT_UNLOCK,
          'OGTEMPLE'
        );
        getBalance();
        handleUpdateOGT(0);
      }
    } catch (e) {
      console.info(e);
    }
  };

  useEffect(() => {
    if (balance) {
      setOGTWalletAmount(balance.ogTemple);
    }
  }, [balance]);

  useEffect(() => {
    async function onMount() {
      await updateWallet();
      setRewards('');
    }

    onMount();
  }, []);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>
          SELECT {OG_TEMPLE_TOKEN} TO UNSTAKE VIA QUEUE
        </ConvoFlowTitle>
        <TooltipPadding>
          <Tooltip
            content={
              <small>
                Your $TEMPLE tokens are unstaked by burning your $OGTEMPLE and
                joining the exit queue. The queue is processed first in, first
                out. Once you are processed, you will be able to claim your
                $TEMPLE tokens.
              </small>
            }
            position={small && repositionTopTooltip ? 'left' : 'top'}
          >
            <a
              className={'color-dark'}
              target={'_blank'}
              href="https://docs.templedao.link/templedao/temple-mechanics"
              rel="noreferrer"
            >
              <TooltipIcon />
            </a>
          </Tooltip>
        </TooltipPadding>
      </TitleWrapper>

      <Input
        small={small}
        hint={`Balance: ${formatNumber(OGTWalletAmount)}`}
        onHintClick={() => copyBalance(OGTWalletAmount, handleUpdateOGT)}
        crypto={{ kind: 'value', value: '$OGTEMPLE' }}
        isNumber
        max={OGTWalletAmount}
        min={0}
        value={OGTAmount}
        handleChange={handleUpdateOGT}
        placeholder={'0.00'}
      />

      <Flex layout={{kind: 'container', direction:'row'}}>
        <Flex layout={{kind:'item', smallMargin:true}}>
          <DataCard
            small={small}
            title={'TEMPLE + REWARDS'}
            data={formatNumber(rewards as number) + '' || '0'}
            tooltipContent={
              'Amount of $TEMPLE received once you exit the queue.'
            }
          />
        </Flex>
        <Flex layout={{kind:'item', smallMargin:true}}>
          <DataCard
            small={small}
            title={'QUEUE LENGTH'}
            data={joinQueueData?.queueLength + ' DAYS'}
            tooltipContent={
              'The current length of the queue due to other templars waiting to be processed in front of you.'
            }
          />
        </Flex>
        <Flex layout={{kind:'item', smallMargin:true}}>
          <DataCard
            small={small}
            title={'PROCESS TIME'}
            data={`+ ${joinQueueData?.processTime} DAYS`}
            tooltipContent={
              'Amount of time it takes to process the $OGTEMPLE that you have selected. Your processing will begin in the number of days specified in the current ‘queue length’.'
            }
          />
        </Flex>
      </Flex>
      <Spacer small />
      <Button
        isSmall={small}
        label={'BURN $OGTEMPLE & JOIN QUEUE'}
        onClick={handleUnlockOGT}
        isUppercase
        disabled={
          OGTAmount == 0 ||
          OGTAmount == '' ||
          (balance != undefined && OGTAmount > balance.ogTemple)
        }
      />
    </ViewContainer>
  );
};
