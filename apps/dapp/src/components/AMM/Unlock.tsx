import React, { FC, useEffect } from 'react';
import ClaimOGTemple from 'components/AMM/helpers/ClaimOGTemple';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { useStaking } from 'providers/StakingProvider';
import { useRefreshState } from 'hooks/use-refresh-state';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import {
  ConvoFlowTitle,
  TitleWrapper,
  TooltipPadding,
  ViewContainer,
} from 'components/AMM/helpers/components';

interface UnlockProps {
  onExitClick?: () => void;
  onReturnClick?: () => void;
}

export const Unlock: FC<UnlockProps> = ({ onExitClick, onReturnClick }) => {
  const { lockedEntries, claimOgTemple } = useStaking();

  const handleClaimOgTemple = async (index: number) => {
    await claimOgTemple(index);
    useRefreshState();
  };

  useEffect(() => {
    async function onMount() {
      await useRefreshState();
    }

    onMount();
  }, []);

  return (
    <ViewContainer>
      <TitleWrapper>
        <ConvoFlowTitle>
          CLAIM YOUR {TICKER_SYMBOL.OG_TEMPLE_TOKEN}
        </ConvoFlowTitle>
        <TooltipPadding>
          <Tooltip
            content={
              <small>
                All your $OGTEMPLE in the locking contract are represented here.
                If your $OGTEMPLE have unlocked, they will be able to be
                claimed.
              </small>
            }
            position={'top'}
          >
            <TooltipIcon />
          </Tooltip>
        </TooltipPadding>
      </TitleWrapper>
      <ClaimOGTemple
        lockedEntries={lockedEntries}
        onClaim={handleClaimOgTemple}
      />
      <Flex
        layout={{
          kind: 'container',
          canWrap: true,
          canWrapTablet: false,
        }}
      >
        {onReturnClick && (
          <Flex
            layout={{
              kind: 'item',
              col: 'half',
            }}
          >
            <Button
              label={'RETURN TO ALTAR'}
              isSmall
              isUppercase
              onClick={onReturnClick}
            />
          </Flex>
        )}
        {onExitClick && (
          <Flex
            layout={{
              kind: 'item',
              col: 'half',
            }}
          >
            <Button
              label={'PROCEED TO EXIT QUEUE'}
              isSmall
              isUppercase
              onClick={onExitClick}
            />
          </Flex>
        )}
      </Flex>
    </ViewContainer>
  );
};
