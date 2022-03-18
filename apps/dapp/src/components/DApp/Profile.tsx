//@ts-nocheck
import React, { FC } from 'react';
import styled from 'styled-components';
import { DataCard } from 'components/DataCard/DataCard';
import { formatNumberWithCommas } from 'utils/formatter';
import useRefreshableAccountMetrics from 'hooks/use-refreshable-account-metrics';
import { Flex } from 'components/Layout/Flex';
import { useFaith } from 'providers/FaithProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

export const Profile: FC = () => {
  const accountMetrics = useRefreshableAccountMetrics();
  const { faith } = useFaith();
  console.log('accountMetrics', accountMetrics);

  return (
    <Container
      layout={{
        kind: 'container',
        direction: 'column',
        justifyContent: 'center',
      }}
    >
      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
        }}
      >
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <DataCard
            title={`NET WORTH ($${formatNumberWithCommas(
              accountMetrics?.netWorth || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.netWorthTemple || 0
            )} ${TICKER_SYMBOL.TEMPLE_TOKEN}`}
            small
          />
        </Flex>
      </Flex>
      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
        }}
      >
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <DataCard
            title={`WALLET ($${formatNumberWithCommas(
              accountMetrics?.walletValue || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.templeBalance || 0
            )} ${TICKER_SYMBOL.TEMPLE_TOKEN}`}
            small
          />
        </Flex>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <DataCard
            title={`EXIT QUEUE ($${formatNumberWithCommas(
              accountMetrics?.exitQueueValue || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.exitQueueTotal || 0
            )} ${TICKER_SYMBOL.TEMPLE_TOKEN}`}
            small
          />
        </Flex>
      </Flex>
      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
        }}
      >
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <DataCard
            title={`STAKED ($${formatNumberWithCommas(
              accountMetrics?.ogTempleWalletValue || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.ogTempleWallet || 0
            )} ${TICKER_SYMBOL.OG_TEMPLE_TOKEN}`}
            small
          />
        </Flex>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <DataCard
            title={`LOCKED ($${formatNumberWithCommas(
              accountMetrics?.lockedOGTempleValue || 0
            )})`}
            data={`${formatNumberWithCommas(
              accountMetrics?.lockedOGTemple || 0
            )} ${TICKER_SYMBOL.OG_TEMPLE_TOKEN}`}
            small
          />
        </Flex>
      </Flex>
      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
        }}
      >
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <DataCard
            title={`USABLE FAITH`}
            data={`${faith.usableFaith} ${TICKER_SYMBOL.FAITH}`}
            small
          />
        </Flex>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <DataCard
            title={`LIFETIME FAITH`}
            data={`${faith.lifeTimeFaith}  ${TICKER_SYMBOL.FAITH}`}
            small
          />
        </Flex>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <DataCard title={`FAITH SHARE`} data={`${faith.share}%`} small />
        </Flex>
      </Flex>
    </Container>
  );
};

const Container = styled(Flex)`
  width: 90%;
`;
