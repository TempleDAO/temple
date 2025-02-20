import styled from 'styled-components';
import usds from 'assets/icons/usds.svg?react';
import templeGold from 'assets/icons/temple-gold.svg?react';
import { Input } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Input';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { useWallet } from 'providers/WalletProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberWithCommas, formatToken } from 'utils/formatter';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import { formatBigNumber } from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { getTokenInfo } from 'components/Vault/utils';
import LargeRoundCheckBox from 'components/Pages/Core/DappPages/SpiceBazaar/components/LargeRoundCheckBox';
import { useAudioPlayer } from 'react-use-audio-player';
import marketSound from 'assets/sounds/Age of Empires 2 - Market Sound.mp3';
import { Button } from 'components/Button/Button';

const PRICE_UPDATE_INTERVAL = 10000;
const FADE_EFFECT_DURATION = 500;

interface BidUSDSProps {
  onBidSubmitted?: () => void;
  mode: BidUSDSMode;
  currentBidAmount?: string;
}

export enum BidUSDSMode {
  IncreaseBid = 'increaseBid',
  Bid = 'bid',
}

export const BidUSDS = ({
  onBidSubmitted,
  mode = BidUSDSMode.Bid,
  currentBidAmount = '0',
}: BidUSDSProps) => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  const { play, load } = useAudioPlayer();

  const [lastTgldPrice, setLastTgldPrice] = useState('0');
  const [lastPriceUpdate, setLastPriceUpdate] = useState(Date.now());
  const [fadeEffect, setFadeEffect] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    daiGoldAuctions: { bid },
    daiGoldAuctionInfo,
  } = useSpiceBazaar();

  const { balance, updateBalance } = useWallet();

  useEffect(() => {
    updateBalance();
  }, [updateBalance]);

  const fetchTGLDPrice = useCallback(async () => {
    await daiGoldAuctionInfo.fetch(true);
    return daiGoldAuctionInfo?.data?.priceRatio || '0';
  }, [daiGoldAuctionInfo]);

  const resetState = useCallback(() => {
    setIsCheckboxChecked1(false);
    setIsCheckboxChecked2(false);
    setInputValue('');
    setIsSubmitting(false);
  }, []);

  const handleBidClick = async (value: string) => {
    const now = Date.now();

    // Check if the price was not updated in the last n seconds
    if (now - lastPriceUpdate > PRICE_UPDATE_INTERVAL) {
      const newPrice = await fetchTGLDPrice().toString();
      if (lastTgldPrice !== newPrice) {
        setFadeEffect(true);
        setTimeout(() => setFadeEffect(false), FADE_EFFECT_DURATION);
        setLastTgldPrice(newPrice);
        setLastPriceUpdate(now);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === BidUSDSMode.IncreaseBid) {
        await bid(value);
      } else {
        await bid(value);
      }
      resetState();
      load(marketSound);
      play();
      onBidSubmitted?.();
    } catch (error) {
      console.error('Bid submission failed:', error);
      setIsSubmitting(false);
    }
  };

  const handleHintClick = () => {
    const amount = balance.USDS.eq(ZERO)
      ? ''
      : formatBigNumber(
          balance.USDS,
          getTokenInfo(TICKER_SYMBOL.USDS).decimals
        );
    setInputValue(amount);
  };

  const [inputValue, setInputValue] = useState('');

  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const calculateTGLDAmount = useCallback(
    (inputUsdsAmount: string): string => {
      if (!inputUsdsAmount) return '0';
      let numericAmount = Number(inputUsdsAmount);

      if (mode === BidUSDSMode.IncreaseBid) {
        numericAmount += Number(currentBidAmount);
      }

      if (isNaN(numericAmount)) return '0';

      const priceRatioAfterBid =
        (Number(daiGoldAuctionInfo?.data?.totalBidTokenAmount) +
          Number(inputUsdsAmount)) /
        Number(daiGoldAuctionInfo?.data?.totalAuctionTokenAmount);

      const amountToReceive = numericAmount / priceRatioAfterBid;
      return amountToReceive.toFixed(2);
    },
    [
      currentBidAmount,
      daiGoldAuctionInfo?.data?.totalAuctionTokenAmount,
      daiGoldAuctionInfo?.data?.totalBidTokenAmount,
      mode,
    ]
  );

  const exceededAmount = useMemo(() => {
    const amountAfterbid = Number(inputValue) + Number(currentBidAmount);

    return (
      Number(calculateTGLDAmount(amountAfterbid.toString())) >
      Number(daiGoldAuctionInfo?.data?.totalAuctionTokenAmount.toFixed(2))
    );
  }, [inputValue, currentBidAmount, daiGoldAuctionInfo, calculateTGLDAmount]);

  const priceRatioAfterBid = useMemo(() => {
    // if no bids have been made, meaning totalBidTokenAmount is 0, then the price
    // ratio is the current bid amount (inputValue) divided by the total auction token amount

    // if bids have been made, then the price ratio is the total bid token amount
    // plus the current bid amount (inputValue) divided by the total auction token amount

    const totalBidTokenAmount = daiGoldAuctionInfo?.data?.totalBidTokenAmount;
    const totalAuctionTokenAmount =
      daiGoldAuctionInfo?.data?.totalAuctionTokenAmount;

    if (totalBidTokenAmount === 0) {
      return Number(inputValue) / Number(totalAuctionTokenAmount);
    }

    return (
      (Number(totalBidTokenAmount) + Number(inputValue)) /
      Number(totalAuctionTokenAmount)
    );
  }, [daiGoldAuctionInfo, inputValue]);

  useEffect(() => {
    // Update price every n seconds
    if (!inputValue || isSubmitting) return;

    const interval = setInterval(async () => {
      const newPrice = await fetchTGLDPrice().toString();
      setFadeEffect(true);
      setTimeout(() => setFadeEffect(false), FADE_EFFECT_DURATION);
      setLastTgldPrice(newPrice);
      setLastPriceUpdate(Date.now());
    }, PRICE_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchTGLDPrice, lastTgldPrice, inputValue, isSubmitting]);

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
        <Title>BID USDS</Title>
      </TitleContainer>
      <Container>
        <AvailableAmountContainer>
          <USDSIcon />
          <AvailableAmountText>
            <AvailableAmount>
              {!balance?.USDS
                ? '0'
                : formatToken(balance.USDS, TICKER_SYMBOL.USDS)}
            </AvailableAmount>
            <AvailableText>AVAILABLE</AvailableText>
          </AvailableAmountText>
        </AvailableAmountContainer>
        <BidContainer>
          {mode === BidUSDSMode.IncreaseBid && (
            <BidContent>
              <TitleBid>Current Bid Amount</TitleBid>
              <Input
                crypto={{
                  kind: 'value',
                  value: 'USDS',
                }}
                placeholder={currentBidAmount}
                isNumber
                readOnly
                min={0}
                width="100%"
              />
            </BidContent>
          )}
          <BidContent>
            <TitleBid>
              {mode === BidUSDSMode.IncreaseBid
                ? 'Amount to Increase'
                : 'Your Bid Amount'}
            </TitleBid>
            <Input
              crypto={{
                kind: 'value',
                value: 'USDS',
              }}
              hint={`Max amount: ${formatToken(
                balance.USDS,
                TICKER_SYMBOL.USDS
              )}`}
              value={inputValue}
              onHintClick={handleHintClick}
              handleChange={handleInputChange}
              isNumber
              placeholder="0.00"
              min={0}
              width="100%"
            />
          </BidContent>
        </BidContainer>
        <ReceiveAmountContainer fadeEffect={fadeEffect}>
          <ReceiveTextTop>You will receive</ReceiveTextTop>
          <ReceiveContainer>
            <TempleGoldIcon />
            <ReceiveAmount fadeEffect={fadeEffect}>
              {inputValue === '' || exceededAmount
                ? '0'
                : formatNumberWithCommas(
                    Number(calculateTGLDAmount(inputValue))
                  )}{' '}
              TGLD
            </ReceiveAmount>
          </ReceiveContainer>
          <ReceiveTextBottom>
            at the current TGLD price of {!isPhoneOrAbove && <br />}
            {daiGoldAuctionInfo.loading
              ? '...'
              : priceRatioAfterBid < 0.001
              ? '<0.001'
              : priceRatioAfterBid.toFixed(4)}{' '}
            USDS per TGLD
          </ReceiveTextBottom>
        </ReceiveAmountContainer>
        {exceededAmount && (
          <WarningMessage>
            <MessageText>
              <InfoCircle>
                <p>i</p>
              </InfoCircle>
              <Text>Amount exceeds TGLD auction limit.</Text>
            </MessageText>
          </WarningMessage>
        )}
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
          style={{ whiteSpace: 'nowrap', margin: '0px', alignSelf: 'center' }}
          onClick={async () => {
            await handleBidClick(inputValue);
          }}
          disabled={
            !inputValue ||
            exceededAmount ||
            fadeEffect ||
            !isCheckboxChecked1 ||
            !isCheckboxChecked2
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
  font-size: 24px;
  line-height: 44px;
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
  gap: 15px;

  ${breakpoints.phoneAndAbove(`
    width: 450px;
  `)}
`;

const USDSIcon = styled(usds)`
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

const ReceiveAmountContainer = styled.div<{ fadeEffect: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};
  gap: 20px;
  padding: 16px;
  opacity: ${({ fadeEffect }) => (fadeEffect ? 0 : 1)};
  transition: opacity 0.5s ease-in-out;
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
  font-size: 18px;
  line-height: 21px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ReceiveTextBottom = styled.div`
  font-size: 16px;
  line-height: 19px;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ReceiveAmount = styled.h3<{ fadeEffect: boolean }>`
  line-height: 52px;
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.gold};
  margin: 0px;
  opacity: ${({ fadeEffect }) => (fadeEffect ? 0.4 : 1)};
  transition: opacity 0.5s ease-in-out;
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

const TradeButton = styled(Button)`
  padding: 12px 20px 12px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: linear-gradient(90deg, #58321a 20%, #95613f 84.5%);
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px 0px #de5c0666;
  border-radius: 10px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;
