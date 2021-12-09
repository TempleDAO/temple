import React from 'react';
import cashImage from 'assets/images/cash.svg';
import lockImage from 'assets/images/lock.svg';
import tagImage from 'assets/images/tag.svg';
import { TreasuryMetrics } from 'services/MetricsService';
import { formatMillions, formatNumber } from 'utils/formatter';
import { Apy } from 'components/Apy/Apy';
import { Flex } from 'components/Layout/Flex';

export interface MetricsProps {
  treasuryMetrics: TreasuryMetrics;
  isHome?: boolean;
}

const Metrics = ({ treasuryMetrics, isHome }: MetricsProps) => {
  const { treasuryValue, templeApy, templeValue } = treasuryMetrics;

  return (
    <Flex
      layout={{
        kind: 'container',
      }}
    >
      <Apy
        cryptoName={'$TEMPLE'}
        value={`$${templeValue}`}
        imageData={{
          imageUrl: cashImage,
          alt: '',
        }}
        isWhite
        isHome={isHome}
      />
      <Apy
        cryptoName={'APY'}
        value={`${formatNumber(templeApy)}%`}
        imageData={{
          imageUrl: tagImage,
          alt: '',
        }}
        isHome={isHome}
      />
      <Apy
        cryptoName={'Treasury'}
        value={`$${formatMillions(treasuryValue)}`}
        imageData={{
          imageUrl: lockImage,
          alt: '',
        }}
        isHome={isHome}
      />
    </Flex>
  );
};

export default Metrics;
