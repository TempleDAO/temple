import React, { useState } from 'react';
import styled from 'styled-components';

import { tabletAndAbove } from 'styles/breakpoints';

import { TICKER_SYMBOL } from 'enums/ticker-symbol';

import StatsCard from 'components/StatsCard/StatsCard';
import { Button } from 'components/Button/Button';

import background2 from 'assets/images/dashboard-2.png';
import background3 from 'assets/images/dashboard-3.png';
import texture2 from 'assets/images/texture-2.svg';

import { Container, Subheading } from '../styles';
import { formatTemple } from 'components/Vault/utils';
import { Popover } from 'components/Popover';
import { Unlock } from 'components/AMM/Unlock';

interface IProps {
  lockedOgTempleBalance?: number;
  faithBalance?: number;
}

export const ProfileLegacyTemple: React.FC<IProps> = ({ lockedOgTempleBalance = 0, faithBalance = 0 }) => {
  const [isClaimPopoverOpen, setClaimPopoverOpen] = useState(false);

  return (
    <>
      <Popover
        isOpen={isClaimPopoverOpen}
        closeOnClickOutside
        onClose={() => setClaimPopoverOpen(false)}
        showCloseButton={false}
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
          <StatsCard
            label={`Usable ${TICKER_SYMBOL.FAITH}`}
            stat={formatTemple(faithBalance)}
            backgroundColor={background2}
            backgroundImageUrl={texture2}
            darken
          />
        </LegacyTempleArea>
        <LegacyTempleArea>
          {!!lockedOgTempleBalance && (
            <Button
              label={`UNLOCK ${TICKER_SYMBOL.OG_TEMPLE_TOKEN}`}
              isSmall
              onClick={() => setClaimPopoverOpen(true)}
            />
          )}
        </LegacyTempleArea>
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
