import React from 'react';
import styled from 'styled-components';
import { LockedEntry } from 'providers/WalletProvider';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';

export interface ClaimOGTempleProps {
  lockedEntries: Array<LockedEntry>;

  onClaim(index: number): void;
}

const ClaimOGTemple = ({ lockedEntries, onClaim }: ClaimOGTempleProps) => {
  return (
    <>
      {lockedEntries.length > 0 ? (
        <>
          <Flex
            layout={{
              kind: 'container',
            }}
          >
            <Flex
              layout={{
                kind: 'item',
                col: 'half',
              }}
            >
              <strong className={'color-brand'}>CLAIMABLE AT</strong>
            </Flex>
            <Flex
              layout={{
                kind: 'item',
                col: 'half',
              }}
            >
              <strong className={'color-brand'}>$OG TEMPLE AMOUNT</strong>
            </Flex>
          </Flex>
          {lockedEntries.map((le) => (
            <>
              <Flex
                layout={{
                  kind: 'container',
                }}
                key={le.index}
              >
                <Flex
                  layout={{
                    kind: 'item',
                    col: 'half',
                  }}
                >
                  <p className={'color-brand'}>
                    {new Date(le.lockedUntilTimestamp).toLocaleString()}
                  </p>
                </Flex>
                <Flex
                  layout={{
                    kind: 'item',
                    col: 'half',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <TempleValue className={'color-brand'}>
                    {le.balanceOGTemple}
                  </TempleValue>
                  <Button
                    label={'claim'}
                    isSmall
                    isUppercase
                    autoWidth
                    onClick={() => onClaim(le.index)}
                    disabled={Date.now() < le.lockedUntilTimestamp}
                  />
                </Flex>
              </Flex>
            </>
          ))}
        </>
      ) : (
        <p>Nothing to claim</p>
      )}
    </>
  );
};

const TempleValue = styled.strong`
  margin-right: 2rem;
`;

export default ClaimOGTemple;
