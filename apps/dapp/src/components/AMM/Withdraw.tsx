import React, { FC, useEffect } from 'react';
import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { Flex } from 'components/Layout/Flex';
import { Button } from 'components/Button/Button';
import { DataCard } from 'components/DataCard/DataCard';
import PercentageBar from 'components/PercentageBar/PercentageBar';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import dateFormat from 'dateformat';
import { TEMPLE_TOKEN, useWallet } from 'providers/WalletProvider';
import { formatNumber } from 'utils/formatter';
import {
  ConvoFlowTitle,
  Spacer,
  TitleWrapper,
  TooltipPadding,
  ViewContainer,
} from 'components/AMM/helpers/components';

interface SizeProps {
  small?: boolean;
}

export const Withdraw: FC<SizeProps> = ({ small }) => {
  const {
    exitQueueData,
    getExitQueueData,
    restakeAvailableTemple,
    claimAvailableTemple,
  } = useWallet();
  const repositionTooltip = useMediaQuery({ query: '(max-width: 980px)' });
  const isSmallOrMediumScreen = useMediaQuery({ query: '(max-width: 800px)' });

  useEffect(() => {
    async function onMount() {
      await getExitQueueData();
    }

    onMount();
  }, []);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>
          YOU HAVE {exitQueueData.totalTempleOwned} {TEMPLE_TOKEN} IN QUEUE
        </ConvoFlowTitle>
        <TooltipPadding>
          <Tooltip
            content={
              <small>
                The exit queue is used to provide an orderly unstaking process
                from the temple.
              </small>
            }
            position={isSmallOrMediumScreen ? 'left' : 'top'}
          >
            <TooltipIcon />
          </Tooltip>
        </TooltipPadding>
      </TitleWrapper>
      <PercentageBar
        small={small}
        total={exitQueueData.totalTempleOwned}
        processed={exitQueueData.claimableTemple}
      />
      <Flex layout={{ kind: 'container' }}>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <StyledDataCard
            //@ts-ignore
            tooltipPosition={isSmallOrMediumScreen ? 'right' : 'top'}
            title={'AVAILABLE TO CLAIM'}
            data={formatNumber(exitQueueData.claimableTemple) + ''}
            tooltipContent={
              'Amount of $TEMPLE that has been processed and is available for withdrawal.'
            }
          />
        </Flex>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <StyledDataCard
            title={'NOT PROCESSED'}
            data={
              formatNumber(
                exitQueueData.totalTempleOwned - exitQueueData.claimableTemple
              ) + ''
            }
            tooltipContent={
              'Amount of $TEMPLE yet to be processed through the queue.'
            }
          />
        </Flex>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <StyledDataCard
            title={'QUEUE PROCESSED BY'}
            //@ts-ignore
            tooltipPosition={small && repositionTooltip ? 'left' : 'top'}
            data={`${dateFormat(
              exitQueueData.lastClaimableEpochAt,
              'dd, mmm h:MM TT'
            )}`}
            tooltipContent={
              'The time at which all of your $TEMPLE will be available to withdraw.'
            }
          />
        </Flex>
      </Flex>
      <Spacer small />
      <ButtonContainer layout={{ kind: 'container' }}>
        <Button
          isSmall={small}
          label={'restake pending $TEMPLE'}
          onClick={restakeAvailableTemple}
          isUppercase
          disabled={
            exitQueueData.totalTempleOwned === 0 &&
            exitQueueData.claimableTemple === 0
          }
        />
        <Button
          isSmall={small}
          label={'withdraw available $TEMPLE'}
          onClick={claimAvailableTemple}
          isUppercase
          disabled={exitQueueData.claimableTemple == 0}
        />
      </ButtonContainer>
    </ViewContainer>
  );
};

const ButtonContainer = styled(Flex)`
  gap: 0.75rem;
`;

const StyledDataCard = styled(DataCard)`
  display: flex;
  justify-content: space-between;

  p {
    font-size: 1rem;
  }
`;
