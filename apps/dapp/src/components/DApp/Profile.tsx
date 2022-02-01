//@ts-nocheck
import React, { FC } from 'react';
import styled from 'styled-components';
import { DataCard } from 'components/DataCard/DataCard';
import { formatNumberWithCommas } from 'utils/formatter';
import useRefreshableAccountMetrics from 'hooks/use-refreshable-account-metrics';
import { Flex } from 'components/Layout/Flex';
import {
  TEMPLE_TOKEN,
  OG_TEMPLE_TOKEN,
  FAITH_TOKEN,
  useWallet,
} from 'providers/WalletProvider';

export const Profile: FC = () => {
  const accountMetrics = useRefreshableAccountMetrics();
  const { faith } = useWallet();

  return (
    <Container
      layout={{
        kind: 'container',
        direction: 'column',
      }}
    >
      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
          justifyContent: 'left',
        }}
      >
        <Flex layout={{ kind: 'item' }}>
          <DataCard
            title={`NET WORTH ($${formatNumberWithCommas(
              accountMetrics?.netWorth || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.netWorthTemple || 0
            )} ${TEMPLE_TOKEN}`}
            small
          />
        </Flex>
      </Flex>
      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
          justifyContent: 'left',
        }}
      >
        <Flex layout={{ kind: 'item' }}>
          <DataCard
            title={`WALLET ($${formatNumberWithCommas(
              accountMetrics?.walletValue || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.templeBalance || 0
            )} ${TEMPLE_TOKEN}`}
            small
          />
        </Flex>
        <Flex layout={{ kind: 'item' }}>
          <DataCard
            title={`EXIT QUEUE ($${formatNumberWithCommas(
              accountMetrics?.exitQueueValue || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.exitQueueTotal || 0
            )} ${TEMPLE_TOKEN}`}
            small
          />
        </Flex>
      </Flex>
      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
          justifyContent: 'left',
        }}
      >
        <Flex layout={{ kind: 'item' }}>
          <DataCard
            title={`STAKED ($${formatNumberWithCommas(
              accountMetrics?.ogTempleWalletValue || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.ogTempleWallet || 0
            )} ${OG_TEMPLE_TOKEN}`}
            small
          />
        </Flex>
        <Flex layout={{ kind: 'item' }}>
          <DataCard
            title={`LOCKED ($${formatNumberWithCommas(
              accountMetrics?.lockedOGTempleValue || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.lockedOGTemple || 0
            )} ${OG_TEMPLE_TOKEN}`}
            small
          />
        </Flex>
      </Flex>
      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
          justifyContent: 'left',
        }}
      >
        <Flex layout={{ kind: 'item' }}>
          <DataCard
            title={`USABLE FAITH`}
            data={`${faith.usableFaith} ${FAITH_TOKEN}`}
            small
          />
        </Flex>
        <Flex layout={{ kind: 'item' }}>
          <DataCard
            title={`LIFETIME FAITH`}
            data={`${faith.lifeTimeFaith}  ${FAITH_TOKEN}`}
            small
          />
        </Flex>
        <Flex layout={{ kind: 'item' }}>
          <DataCard title={`FAITH SHARE`} data={`${faith.share}%`} small />
        </Flex>
      </Flex>
    </Container>
  );
};

const Container = styled(Flex)`
  width: 90%;
`;
