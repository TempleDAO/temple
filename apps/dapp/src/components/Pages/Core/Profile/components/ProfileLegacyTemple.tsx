import React, { useState } from 'react';
import styled from 'styled-components';
import { BigNumber } from 'ethers';

import { tabletAndAbove } from 'styles/breakpoints';

import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import StatsCard from 'components/Pages/Core/Profile/components/StatsCard';
import { Button } from 'components/Button/Button';

import background2 from 'assets/images/dashboard-2.png';
import background3 from 'assets/images/dashboard-3.png';
import texture2 from 'assets/images/texture-2.svg';

import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { Container, Subheading } from '../styles';
import { formatTemple } from 'components/Vault/utils';
import { Popover } from 'components/Popover';
import { Unlock } from 'components/AMM/Unlock';
import { ZERO } from 'utils/bigNumber';

interface IProps {
  lockedOgTempleBalance?: BigNumber;
  faithBalance?: BigNumber;
}

export const ProfileLegacyTemple: React.FC<IProps> = ({
  lockedOgTempleBalance = ZERO,
  faithBalance = ZERO,
}) => {
  const [isClaimPopoverOpen, setClaimPopoverOpen] = useState(false);

  return (
    <>
      <Popover
        isOpen={isClaimPopoverOpen}
        closeOnClickOutside
        onClose={() => setClaimPopoverOpen(false)}
        showCloseButton={false}
        header={
          <HeaderWrapper>
            <TitleText>Claim {TICKER_SYMBOL.OG_TEMPLE_TOKEN}</TitleText>
            <Tooltip
              content={
                <>
                  All your $OGTEMPLE in the locking contract are represented
                  here. If your $OGTEMPLE have unlocked, they will be able to be
                  claimed.
                </>
              }
              position={'top'}
            >
              <TooltipIcon />
            </Tooltip>
          </HeaderWrapper>
        }
      >
        <Unlock />
      </Popover>
      <Container>
        <Subheading>Temple Legacy</Subheading>
        <LegacyTempleArea>
          <StatsCard
            label={`${TICKER_SYMBOL.OG_TEMPLE_TOKEN} Locked from Opening Ceremony`}
            stat={formatTemple(lockedOgTempleBalance)}
            backgroundImageUrl={background3}
            darken
          />
        </LegacyTempleArea>
        {lockedOgTempleBalance.gt(ZERO) && (
          <LegacyTempleArea>
            <Button
              label={`UNLOCK ${TICKER_SYMBOL.OG_TEMPLE_TOKEN}`}
              isSmall
              onClick={() => setClaimPopoverOpen(true)}
            />
          </LegacyTempleArea>
        )}
      </Container>
    </>
  );
};

const LegacyTempleArea = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;

  ${tabletAndAbove(`
    grid-template-columns: 1fr 1fr 1fr 1fr;
  `)}
`;

const HeaderWrapper = styled.div`
  display: inline-flex;
  align-items: center;
`;

const TitleText = styled.div`
  margin-right: 1rem;
`;
