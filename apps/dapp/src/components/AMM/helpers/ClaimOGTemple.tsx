import { format, isDate } from 'date-fns';
import styled from 'styled-components';

import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import { LockedEntry } from 'providers/types';
import { formatNumber } from 'utils/formatter';
import { formatBigNumber } from 'components/Vault/utils';

export interface ClaimOGTempleProps {
  lockedEntries: Array<LockedEntry>;

  onClaim(index: number): void;
}

const ClaimOGTemple = ({ lockedEntries = [], onClaim }: ClaimOGTempleProps) => {
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
                <FontStyling>
                  <strong className={'color-dark'}>CLAIMABLE AT</strong>
                </FontStyling>
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  col: 'half',
                }}
              >
                <HeaderRight>
                  <strong className={'color-dark'}>AMOUNT</strong>
                </HeaderRight>
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
                  <DateWrapper className={'color-brand'}>
                    {format(le.lockedUntilTimestamp, 'MMM do p')}
                  </DateWrapper>
                </Flex>
                <Flex
                  layout={{
                    kind: 'item',
                    col: 'half',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <AmountWrapper>
                    <strong className={'color-brand'}>
                      {formatNumber(formatBigNumber(le.balanceOGTemple))}
                    </strong>
                  </AmountWrapper>
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
  background-color: ${(props) => props.theme.palette.brand25};
`;

const FontStyling = styled.span`
  font-size: 0.875rem;
  display: flex;
  align-items: center;
`;

const AmountWrapper = styled(FontStyling)`
  margin-right: 20px;
  font-size: 0.875rem;
`;

const HeaderRight = styled(FontStyling)`
  margin: 0 1rem 0 auto;
`;

const DateWrapper = styled(FontStyling)`
  font-size: 0.875rem;
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
