import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import dai from 'assets/icons/Dai.svg?react';
import templeGold from 'assets/icons/temple-gold.svg?react';
import { Input } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Input';

export const BidDai = () => {
  return (
    <ContentContainer>
      <TitleContainer>
        <Title>BID DAI</Title>
      </TitleContainer>
      <Container>
        <AvailableAmountContainer>
          <DaiIcon />
          <AvailableAmountText>
            <AvailableAmount>70.53 DAI </AvailableAmount>
            <AvailableText>AVAILABLE</AvailableText>
          </AvailableAmountText>
        </AvailableAmountContainer>
        <BidContainer>
          <BidContent>
            <TitleBid>Current Bid Amount</TitleBid>
            <Input
              crypto={{
                kind: 'value',
                value: 'DAI',
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
                value: 'DAI',
              }}
              isNumber
              placeholder="150"
              min={0}
              width="100%"
            />
          </BidContent>
        </BidContainer>
        <ReceiveAmountContainer>
          <ReceiveTextTop>You will receive</ReceiveTextTop>
          <ReceiveContainer>
            <TempleGoldIcon />
            <ReceiveAmount>1 TGLD</ReceiveAmount>
          </ReceiveContainer>
          <ReceiveTextBottom>
            at the current TGLD priece of 5.32 DAI per TGLD
          </ReceiveTextBottom>
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
          style={{ whiteSpace: 'nowrap', marginTop: '0px' }}
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
`;

const TitleContainer = styled.div`
  display: flex;
  flex-direction: row;
  height: 77px;
  width: 624px;
  justify-content: center;
  align-items: center;
  background: ${({ theme }) => theme.palette.gradients.grey};
`;

const Title = styled.h3`
  diplay: flex;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 28px;
  font-weight: 400;
  line-height: 52px;
  text-align: center;
  margin: 0px;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 450px;
  align-items: center;
  flex-grow: 1;
  padding: 8px 0px 8px 0px;
  gap: 24px;
`;

const AvailableAmountContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px 24px 0px 24px;
  width: 450px;
  gap: 10px;
`;

const DaiIcon = styled(dai)`
  width: 42px;
  height: 42px;
`;

const AvailableAmountText = styled.div`
  display: flex;
  flex-direction: column;
`;

const AvailableAmount = styled.h3`
  font-weight: 400;
  font-size: 28px;
  line-height: 52px;
  font-weight: 400;
  color: ${({ theme }) => theme.palette.brandLight};
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
  font-weight: 400;
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ReceiveAmountContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};
  gap: 20px;
  padding: 16px;
`;

const TempleGoldIcon = styled(templeGold)``;

const ReceiveContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20px;
`;

const ReceiveTextTop = styled.div`
  font-weight: 400;
  letter-spacing: -0.02em;
  font-size: 18px;
  line-height: 21px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ReceiveTextBottom = styled.div`
  font-size: 16px;
  font-weight: 400;
  line-height: 19px;
  letter-spacing: 0.05em;
  span {
    font-weight: 700;
  }
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ReceiveAmount = styled.h3`
  line-height: 52px;
  font-size: 28px;
  line-height: 52px;
  font-weight: 400;
  color: ${({ theme }) => theme.palette.gold};
  margin: 0px;
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

export const TradeButton = styled(Button)`
  padding: 12px 20px 12px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 1px solid ${({ theme }) => theme.palette.brandDark}; //if button is not active this is not used
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4); //if button is not active this is not used
  border-radius: 10px;
  font-size: 16px;
  line-height: 19px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;
