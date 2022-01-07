import dateFormat from 'dateformat';
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
                <strong className={'color-dark'}>$OG TEMPLE AMOUNT</strong>
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
                    {le.balanceOGTemple}
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
`;

const Indent = styled.div`
  padding-left: 1rem;
`;

export default ClaimOGTemple;
