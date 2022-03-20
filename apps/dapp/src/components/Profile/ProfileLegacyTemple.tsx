import React from 'react';
import styled from 'styled-components';

import { tabletAndAbove } from 'styles/breakpoints';

import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import StatsCard from 'components/StatsCard/StatsCard';
import { formatNumberWithCommas } from 'utils/formatter';

import background1 from 'assets/images/dashboard-1.png';
import background2 from 'assets/images/dashboard-2.png';
import background3 from 'assets/images/dashboard-3.png';
import background4 from 'assets/images/dashboard-4.png';
import texture2 from 'assets/images/texture-2.svg';
import { Button } from 'components/Button/Button';

export const ProfileLegacyTemple: React.FC<{
  lockedOgTempleBalance?: number;
  ogTempleBalance?: number;
  faithBalance?: number;
}> = ({ lockedOgTempleBalance, ogTempleBalance, faithBalance }) => {
  return (
    <>
      <LegacyTempleArea>
        <StatsCard
          label={`${TICKER_SYMBOL.OG_TEMPLE_TOKEN} (Locked)`}
          stat={formatNumberWithCommas(lockedOgTempleBalance ?? 0)}
          backgroundImageUrl={background3}
          darken
        />
        <StatsCard
          label={`${TICKER_SYMBOL.OG_TEMPLE_TOKEN} (Unlocked)`}
          stat={formatNumberWithCommas(ogTempleBalance ?? 0)}
          backgroundImageUrl={background1}
          darken
        />
        <StatsCard
          label={TICKER_SYMBOL.FAITH}
          stat={formatNumberWithCommas(faithBalance ?? 0)}
          backgroundColor={background2}
          backgroundImageUrl={texture2}
          darken
        />
        <StatsCard
          label={'Redeemable for'}
          stat={`0 ${TICKER_SYMBOL.TEMPLE_TOKEN}`}
          backgroundImageUrl={background4}
          darken
        />
      </LegacyTempleArea>
      <LegacyTempleArea>
        <Button
          label={`Redeem ${TICKER_SYMBOL.TEMPLE_TOKEN}`}
          isSmall
          className="button-redeem"
        />
      </LegacyTempleArea>
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

    button {
      grid-column: 4;
    }
  `)}
`;
