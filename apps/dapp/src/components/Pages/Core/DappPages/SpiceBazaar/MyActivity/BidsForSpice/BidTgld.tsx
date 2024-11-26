import styled from 'styled-components';
import { TradeButton } from '../BidsForTGLD/BidUSDS';
import templeGold from 'assets/icons/temple-gold.svg?react';
import { Input } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Input';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

export const BidTgld = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  return (
    <ContentContainer>
      <TitleContainer>
        <Title>BID TGLD</Title>
      </TitleContainer>
      <Container>
        <AvailableAmountContainer>
          <TempleGoldIcon />
          <AvailableAmountText>
            <AvailableAmount>70.53 TGLD </AvailableAmount>
            <AvailableText>AVAILABLE</AvailableText>
          </AvailableAmountText>
        </AvailableAmountContainer>
        <BidContainer>
          <BidContent>
            <TitleBid>Current Bid Amount</TitleBid>
            <Input
              crypto={{
                kind: 'value',
                value: 'TGLD',
              }}
              isNumber
              placeholder="100"
              min={0}
              width="100%"
            />
          </BidContent>
          <BidContent>
            <TitleBid>New Bid Amount</TitleBid>
            <Input
              crypto={{
                kind: 'value',
                value: 'TGLD',
              }}
              isNumber
              placeholder="150"
              min={0}
              width="100%"
            />
          </BidContent>
        </BidContainer>
        <ReceiveAmountContainer>
          If the current bid price holds, you will {!isPhoneOrAbove && <br />}
          receive X {isPhoneOrAbove && <br />}
          TOKEN at 5.32 TGLD per TOKEN
        </ReceiveAmountContainer>
        <WarningMessage>
          <InfoCircle>
            <p>i</p>
          </InfoCircle>
          <MessageText>
            <Text>
              Current TGLD price may rise before the end of the auction.
            </Text>
            <Text>
              Once submitted, the bid cannot be withdrawn or cancelled.
            </Text>
          </MessageText>
        </WarningMessage>
        <TradeButton
          style={{
            whiteSpace: 'nowrap',
            marginTop: '0px',
            alignSelf: 'center',
          }}
          onClick={() => console.log('clicked')}
        >
          SUBMIT NEW BID
        </TradeButton>
      </Container>
    </ContentContainer>
  );
};

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-grow: 1;
  gap: 32px;
  max-width: 393px;
  padding: 0px 16px 0px 16px;

  ${breakpoints.phoneAndAbove(`
    max-width: 100%;
    padding: 0px 0px 0px 0px;
  `)}
`;

const TitleContainer = styled.div`
  display: flex;
  flex-direction: row;
  height: 77px;
  width: 100%;
  justify-content: center;
  align-items: center;
  background: ${({ theme }) => theme.palette.gradients.grey};

  ${breakpoints.phoneAndAbove(`
    width: 624px;
  `)}
`;

const Title = styled.h3`
  diplay: flex;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 28px;
  line-height: 52px;
  text-align: center;
  margin: 0px;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 450px;
  flex-grow: 1;
  padding: 8px 0px 8px 0px;
  gap: 24px;
  width: 360px;

  ${breakpoints.phoneAndAbove(`
    width: 450px;
  `)}
`;

const AvailableAmountContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px 24px 0px 24px;
  gap: 10px;

  ${breakpoints.phoneAndAbove(`
    width: 450px;
  `)}
`;

const TempleGoldIcon = styled(templeGold)`
  width: 42px;
  height: 42px;
`;

const AvailableAmountText = styled.div`
  display: flex;
  flex-direction: column;
`;

const AvailableAmount = styled.h3`
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.gold};
  margin: 0px;
`;

const AvailableText = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
`;

const BidContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  border-top: 2px solid ${({ theme }) => theme.palette.brand};
  border-bottom: 2px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.gradients.grey};
  padding: 24px;
  gap: 32px;
`;

const BidContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TitleBid = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ReceiveAmountContainer = styled.p`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0px 24px 0px 24px;
  font-size: 16px;
  line-height: 19px;
  margin: 0px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const InfoCircle = styled.div`
  display: flex;
  margin: 0.25rem;
  padding: 0.5rem;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.palette.brand};
`;

const MessageText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Text = styled.p`
  margin: 0px;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
`;

const WarningMessage = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  border: 2px solid transparent;
  border-image-source: linear-gradient(
    180deg,
    rgba(149, 97, 63, 0.1) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  border-image-slice: 1;
  border-radius: 6px;
  padding: 10px 0px 10px 10px;
  gap: 10px;
  background: #24272c;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
`;
