//@ts-nocheck
import React, { FC } from 'react';
import styled from 'styled-components';
import { DataCard } from 'components/DataCard/DataCard';
import { formatNumberWithCommas } from 'utils/formatter';
import useRefreshableAccountMetrics from 'hooks/use-refreshable-account-metrics';
import { Flex } from 'components/Layout/Flex';
import { FAITH_SYMBOL, useWallet } from 'providers/WalletProvider';
import {
  OG_TEMPLE_TOKEN_SYMBOL,
  TEMPLE_TOKEN_SYMBOL,
  FAITH_SYMBOL,
} from 'enums/symbols';

export const Profile: FC = () => {
  const accountMetrics = useRefreshableAccountMetrics();
  const { faith } = useWallet();

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
            )} ${TEMPLE_TOKEN_SYMBOL}`}
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
            )} ${TEMPLE_TOKEN_SYMBOL}`}
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
            )} ${TEMPLE_TOKEN_SYMBOL}`}
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
            )} ${OG_TEMPLE_TOKEN_SYMBOL}`}
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
            )} ${OG_TEMPLE_TOKEN_SYMBOL}`}
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
            data={`${faith.usableFaith} ${FAITH_SYMBOL}`}
            small
          />
        </Flex>
        <Flex layout={{ kind: 'item', smallMargin: true }}>
          <DataCard
            title={`LIFETIME FAITH`}
            data={`${faith.lifeTimeFaith}  ${FAITH_SYMBOL}`}
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
