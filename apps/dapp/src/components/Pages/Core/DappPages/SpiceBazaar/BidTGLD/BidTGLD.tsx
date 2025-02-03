import styled from 'styled-components';
import { TradeButton } from './Details/Details';
import templeGold from 'assets/icons/temple-gold.svg?react';
import { Input } from '.././components/Input';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { useState } from 'react';
import LargeRoundCheckBox from 'components/Pages/Core/DappPages/SpiceBazaar/components/LargeRoundCheckBox';

export const BidTGLD = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const [inputValue, setInputValue] = useState<string>('');
  const handleInputChange = (e: any) => {
    setInputValue(e.target.value);
  };
  const availableAmount = 70.53;

  const [isCheckboxChecked1, setIsCheckboxChecked1] = useState(false);
  const handleCheckboxToggle1 = (checked: boolean) => {
    setIsCheckboxChecked1(checked);
  };

  const [isCheckboxChecked2, setIsCheckboxChecked2] = useState(false);
  const handleCheckboxToggle2 = (checked: boolean) => {
    setIsCheckboxChecked2(checked);
  };

  return (
    <ContentContainer>
      <TitleContainer>
        <Title>BID TGLD</Title>
      </TitleContainer>
      <Container>
        <AvailableAmountContainer>
          <TempleGoldIcon />
          <AvailableAmountText>
            <AvailableAmount>{availableAmount} TGLD </AvailableAmount>
            <AvailableText>AVAILABLE</AvailableText>
          </AvailableAmountText>
        </AvailableAmountContainer>
        <BidContainer>
          <BidContent>
            <TitleBid>Your Bid Amount</TitleBid>
            <Input
              crypto={{
                kind: 'value',
                value: 'TGLD',
              }}
              isNumber
              placeholder="0.00"
              min={0}
              width="100%"
              value={inputValue}
              onChange={handleInputChange}
            />
          </BidContent>
        </BidContainer>
        <ReceiveText>
          If the current bid price holds, you will {!isPhoneOrAbove && <br />}
          receive X {isPhoneOrAbove && <br />}
          TOKEN at 5.32 TGLD per TOKEN
        </ReceiveText>
        <WarningMessage>
          <MessageText>
            <LargeRoundCheckBox
              checked={isCheckboxChecked1}
              onToggle={handleCheckboxToggle1}
            />
            <Text>
              Current TGLD price may rise before the end of the auction.
            </Text>
          </MessageText>
          <MessageText>
            <LargeRoundCheckBox
              checked={isCheckboxChecked2}
              onToggle={handleCheckboxToggle2}
            />
            <Text>Once submitted, bids cannot be withdrawn or canceled.</Text>
          </MessageText>
        </WarningMessage>
        <TradeButton
          style={{
            whiteSpace: 'nowrap',
            marginTop: '0px',
            alignSelf: 'center',
          }}
          onClick={() => console.log('clicked')}
          disabled={
            availableAmount > parseFloat(inputValue) && inputValue !== '0'
              ? false
              : true || !isCheckboxChecked1 || !isCheckboxChecked2
          }
        >
          SUBMIT BID
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

const TempleGoldIcon = styled(templeGold)`
  width: 42px;
  height: 42px;
`;

const ReceiveText = styled.div`
  padding: 0px 20px 0px 20px;
  font-size: 16px;
  line-height: 19px;
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
  flex-direction: row;
  gap: 10px;
  align-items: center;
`;

const Text = styled.p`
  margin: 0px;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
`;

const WarningMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
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
`;
