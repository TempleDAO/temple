import ClaimOGTemple from 'components/AMM/helpers/ClaimOGTemple';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { OG_TEMPLE_TOKEN, useWallet } from 'providers/WalletProvider';
import React, { FC, useEffect } from 'react';
import {
  ConvoFlowTitle,
  TitleWrapper,
  TooltipPadding,
} from 'components/AMM/helpers/components';

interface UnlockProps {
  onExitClick?: () => void;
  onReturnClick?: () => void;
}

export const Unlock: FC<UnlockProps> = ({ onExitClick, onReturnClick }) => {
  const { updateWallet, lockedEntries, claimOgTemple } = useWallet();

  const handleClaimOgTemple = async (index: number) => {
    await claimOgTemple(index);
    updateWallet();
  };

  useEffect(() => {
    async function onMount() {
      await updateWallet();
    }

    onMount();
  }, []);

  return (
    <>
      <TitleWrapper>
        <ConvoFlowTitle>CLAIM YOUR {OG_TEMPLE_TOKEN}</ConvoFlowTitle>
        <TooltipPadding>
          <Tooltip
            content={
              <small>
                All your $OGTEMPLE in the locking contract are represented here.
                if your $OGTEMPLE have unlocked, they will be able to be
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
    </>
  );
};
