import { FC, useEffect } from 'react';
import ClaimOGTemple from 'components/AMM/helpers/ClaimOGTemple';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import { useStaking } from 'providers/StakingProvider';
import { ViewContainer } from 'components/AMM/helpers/components';

interface UnlockProps {
  onExitClick?: () => void;
  onReturnClick?: () => void;
}

export const Unlock: FC<UnlockProps> = ({ onExitClick, onReturnClick }) => {
  const { lockedEntries, updateLockedEntries, claimOgTemple } = useStaking();

  const handleClaimOgTemple = async (index: number) => {
    await claimOgTemple(index);
    updateLockedEntries();
  };

  useEffect(() => {
    async function onMount() {
      await updateLockedEntries();
    }

    onMount();
  }, []);

  return (
    <ViewContainer>
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
