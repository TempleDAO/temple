import React from 'react';
import styled from 'styled-components';

import { TreasuryMetrics } from 'services/MetricsService';
import { formatMillions, formatNumber } from 'utils/formatter';
import { Apy } from 'components/Apy/Apy';
import { aboveMobileBreakpoint } from 'styles/breakpoints';

import cashImage from 'assets/images/cash.svg';
import lockImage from 'assets/images/lock.svg';
import tagImage from 'assets/images/tag.svg';

export interface MetricsProps {
  treasuryMetrics: TreasuryMetrics;
  isHome?: boolean;
  alignCenter?: boolean;
}

const Metrics = ({ treasuryMetrics, isHome, alignCenter, }: MetricsProps) => {
  const { treasuryValue, templeApy, templeValue } = treasuryMetrics;

  return (
    <Wrapper isHome={isHome}>
      <ApyWrapper>
        <Apy
          cryptoName={'$TEMPLE'}
          value={`$${formatNumber(templeValue)}`}
          imageData={{
            imageUrl: cashImage,
            alt: '',
          }}
          isWhite
          isHome={isHome}
          alignCenter={alignCenter}
        />
      </ApyWrapper>
      <ApyWrapper>
        <Apy
          cryptoName={'APY'}
          value={`${formatNumber(templeApy)}%`}
          imageData={{
            imageUrl: tagImage,
            alt: '',
          }}
          isHome={isHome}
          alignCenter={alignCenter}
        />
      </ApyWrapper>
      <ApyWrapper>
        <Apy
          cryptoName={'Treasury'}
          value={`$${formatMillions(treasuryValue)}`}
          imageData={{
            imageUrl: lockImage,
            alt: '',
          }}
          isHome={isHome}
          alignCenter={alignCenter}
        />
      </ApyWrapper>
    </Wrapper>
  );
};

const Wrapper = styled.div<{ isHome?: boolean }>`
  max-width: ${({ isHome }) => isHome ? '26.5rem' : '100%'};
  display: flex;
  flex-direction: row;
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;

  ${aboveMobileBreakpoint(`
    justify-content: flex-start;
  `)}
`;

const ApyWrapper = styled.div`
  margin-left: 2rem;

  &:first-of-type {
    margin-left: 0;
  }

  ${aboveMobileBreakpoint(`
    margin-left: 4rem;
  `)}
`;

export default Metrics;
