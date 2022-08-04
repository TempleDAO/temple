import React from 'react';
import styled from 'styled-components';

import { TreasuryMetrics } from 'services/MetricsService';
import { formatMillions, formatNumber } from 'utils/formatter';
import { Apy } from 'components/Apy/Apy';
import * as breakpoints from 'styles/breakpoints';
import { FALLBACK_VAULT_APY } from 'components/Pages/Core/Trade/constants';

import cashImage from 'assets/images/cash.svg';
import lockImage from 'assets/images/lock.svg';
import tagImage from 'assets/images/tag.svg';

export interface MetricsProps {
  treasuryMetrics: TreasuryMetrics;
  isHome?: boolean;
  alignCenter?: boolean;
}

const Metrics = ({ treasuryMetrics, isHome, alignCenter }: MetricsProps) => {
  const { treasuryValue, templeValue, dynamicVaultApy } = treasuryMetrics;

  const dynamicApy = dynamicVaultApy || FALLBACK_VAULT_APY;

  return (
    <Wrapper>
      <ApyWrapper>
        <Apy
          cryptoName={'$TEMPLE'}
          value={`$${formatNumber(templeValue)}`}
          imageData={{
            imageUrl: cashImage,
            alt: '',
          }}
          isHome={isHome}
          alignCenter={alignCenter}
        />
      </ApyWrapper>
      <ApyWrapper>
        <Apy
          cryptoName={'vAPY'}
          value={`${formatNumber(dynamicApy)}%`}
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

const Wrapper = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;

  ${breakpoints.tabletAndAbove(`
    justify-content: flex-start;
  `)}
`;

const ApyWrapper = styled.div`
  margin-left: 2rem;

  &:first-of-type {
    margin-left: 0;
  }

  ${breakpoints.tabletAndAbove(`
    margin-left: 4rem;
  `)}
`;

export default Metrics;
