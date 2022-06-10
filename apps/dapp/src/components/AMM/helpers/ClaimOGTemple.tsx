import React from 'react';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import dateFormat from 'dateformat';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { LockedEntry } from 'providers/types';
import styled from 'styled-components';
import { fromAtto } from 'utils/bigNumber';

export interface ClaimOGTempleProps {
  lockedEntries: Array<LockedEntry>;

  onClaim(index: number): void;
}

const ClaimOGTemple = ({ lockedEntries, onClaim }: ClaimOGTempleProps) => {
  return (
    <>
      {lockedEntries.length > 0 ? (
        <>
          <Header>
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
                <strong className={'color-dark'}>CLAIMABLE AT</strong>
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'half',
                }}
              >
                <strong className={'color-dark'}>
                  {TICKER_SYMBOL.OG_TEMPLE_TOKEN} AMOUNT
                </strong>
              </Flex>
            </Flex>
          </Header>
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
                  <Indent />
                  <p className={'color-brand'}>
                    {dateFormat(le.lockedUntilTimestamp)}
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
                  <strong className={'color-brand'}>
                    {fromAtto(le.balanceOGTemple)}
                  </strong>
                  <ButtonClaim
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

const ButtonClaim = styled(Button)`
  margin-right: 1rem;
  background-color: ${(props) => props.theme.palette.brand25};
`;

const Header = styled.div`
  background-color: ${(props) => props.theme.palette.brand};
  padding-left: 1rem;
  width: 100%;
`;

const Indent = styled.div`
  padding-left: 1rem;
`;

export default ClaimOGTemple;
