import styled from 'styled-components';
import templeGold from 'assets/icons/temple-gold.svg?react';
import { Input } from '../components/Input';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { useWallet } from 'providers/WalletProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatToken, formatNumberWithCommas } from 'utils/formatter';
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  SpiceAuctionInfo,
  useSpiceAuction,
} from 'providers/SpiceAuctionProvider';
import { ZERO } from 'utils/bigNumber';
import LargeRoundCheckBox from 'components/Pages/Core/DappPages/SpiceBazaar/components/LargeRoundCheckBox';
import { useAudioPlayer } from 'react-use-audio-player';
import marketSound from 'assets/sounds/Age of Empires 2 - Market Sound.mp3';
import { TradeButton } from './Details/Details';
import { useConnectWallet } from '@web3-onboard/react';

const PRICE_UPDATE_INTERVAL = 10000;
const FADE_EFFECT_DURATION = 500;

interface BidTGLDProps {
  onBidSuccess: () => Promise<void>;
  mode: BidTGLDMode;
  currentBidAmount?: string;
  auction?: SpiceAuctionInfo;
  isLoadingUserMetrics: boolean;
}

export enum BidTGLDMode {
  IncreaseBid = 'increaseBid',
  Bid = 'bid',
}

export const BidTGLD = ({
  onBidSuccess,
  mode = BidTGLDMode.Bid,
  currentBidAmount = '0',
  auction,
  isLoadingUserMetrics,
}: BidTGLDProps) => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  const { play, load } = useAudioPlayer();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [fadeEffect, setFadeEffect] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(Date.now());
  const {
    spiceAuctions: { bid },
    allSpiceAuctions,
  } = useSpiceAuction();
  const { wallet, balance, updateBalance } = useWallet();
  const [{}, connect] = useConnectWallet();

  useEffect(() => {
    updateBalance();
  }, [updateBalance]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const handleBidClick = async () => {
    if (!auction) return;

    setIsSubmitting(true);

    try {
      await bid(auction.staticConfig, inputValue);
      load(marketSound);
      play();
      await onBidSuccess();
    } catch (error) {
      console.error('Bid submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHintClick = () => {
    const amount = balanceToken.eq(ZERO)
      ? ''
      : formatToken(balanceToken, TICKER_SYMBOL.TEMPLE_GOLD_TOKEN);
    setInputValue(amount);
  };

  const calculateTokenAmount = useCallback(
    (inputTgldAmount: string): string => {
      if (!inputTgldAmount) return '0';
      let numericAmount = Number(inputTgldAmount);

      if (mode === BidTGLDMode.IncreaseBid) {
        numericAmount += Number(currentBidAmount);
      }

      if (isNaN(numericAmount)) return '0';

      const priceRatioAfterBid =
        (Number(auction?.totalBidTokenAmount) + Number(inputTgldAmount)) /
        Number(auction?.totalAuctionTokenAmount);

      const amountToReceive = numericAmount / priceRatioAfterBid;
      return amountToReceive.toFixed(2);
    },
    [
      currentBidAmount,
      auction?.totalAuctionTokenAmount,
      auction?.totalBidTokenAmount,
      mode,
    ]
  );

  const exceededAmount = useMemo(() => {
    const amountAfterbid = Number(inputValue) + Number(currentBidAmount);
    return (
      Number(calculateTokenAmount(amountAfterbid.toString())) >
      Number(auction?.totalAuctionTokenAmount?.toFixed(2))
    );
  }, [inputValue, currentBidAmount, auction, calculateTokenAmount]);

  const [isCheckboxChecked1, setIsCheckboxChecked1] = useState(false);
  const handleCheckboxToggle1 = (checked: boolean) => {
    setIsCheckboxChecked1(checked);
  };

  const [isCheckboxChecked2, setIsCheckboxChecked2] = useState(false);
  const handleCheckboxToggle2 = (checked: boolean) => {
    setIsCheckboxChecked2(checked);
  };

  const auctionName = auction?.name || 'TGLD';

  const balanceToken = useMemo(() => {
    if (!auction) return balance.TGLD;

    return balance[auction.staticConfig.templeGoldTokenBalanceTickerSymbol];
  }, [balance, auction]);

  const priceRatioAfterBid = useMemo(() => {
    // if no bids have been made, meaning totalBidTokenAmount is 0, then the price
    // ratio is the current bid amount (inputValue) divided by the total auction token amount

    // if bids have been made, then the price ratio is the total bid token amount
    // plus the current bid amount (inputValue) divided by the total auction token amount

    const totalBidTokenAmount = auction?.totalBidTokenAmount;
    const totalAuctionTokenAmount = auction?.totalAuctionTokenAmount;

    if (totalBidTokenAmount === 0) {
      return Number(inputValue) / Number(totalAuctionTokenAmount);
    }

    return (
      (Number(totalBidTokenAmount) + Number(inputValue)) /
      Number(totalAuctionTokenAmount)
    );
  }, [auction, inputValue]);

  // Update price every n seconds
  useEffect(() => {
    if (!inputValue || isSubmitting) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      if (now - lastPriceUpdate > PRICE_UPDATE_INTERVAL) {
        await allSpiceAuctions.fetch();
        setFadeEffect(true);
        setTimeout(() => setFadeEffect(false), FADE_EFFECT_DURATION);
        setLastPriceUpdate(now);
      }
    }, PRICE_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [inputValue, isSubmitting, lastPriceUpdate, allSpiceAuctions]);

  return (
    <ContentContainer>
      <TitleContainer>
        <Title>BID {auctionName}</Title>
      </TitleContainer>
      <Container>
        <AvailableAmountContainer>
          <TempleGoldIcon />
          <AvailableAmountText>
            <AvailableAmount>
              {!balanceToken
                ? '0'
                : formatToken(balanceToken, TICKER_SYMBOL.TEMPLE_GOLD_TOKEN)}
            </AvailableAmount>
            <AvailableText>AVAILABLE</AvailableText>
          </AvailableAmountText>
        </AvailableAmountContainer>
        <BidContainer>
          {mode === BidTGLDMode.IncreaseBid && (
            <BidContent>
              <TitleBid>Current Bid Amount</TitleBid>
              <Input
                crypto={{
                  kind: 'value',
                  value: 'TGLD',
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
              {mode === BidTGLDMode.IncreaseBid
                ? 'Amount to Increase'
                : 'Your Bid Amount'}
            </TitleBid>
            <Input
              crypto={{
                kind: 'value',
                value: 'TGLD',
              }}
              hint={`Max amount: ${formatToken(
                balanceToken,
                TICKER_SYMBOL.TEMPLE_GOLD_TOKEN
              )} TGLD`}
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
        {wallet ? (
          <>
            <ReceiveAmountContainer fadeEffect={fadeEffect}>
              <ReceiveTextTop>You will receive</ReceiveTextTop>
              <ReceiveContainer>
                <TempleGoldIcon />
                <ReceiveAmount fadeEffect={fadeEffect}>
                  {inputValue === '' || exceededAmount
                    ? '0'
                    : formatNumberWithCommas(
                        Number(calculateTokenAmount(inputValue))
                      )}{' '}
                  {auction?.auctionTokenSymbol || 'X TOKEN'}
                </ReceiveAmount>
              </ReceiveContainer>
              <ReceiveTextBottom>
                at the current price of {!isPhoneOrAbove && <br />}
                {priceRatioAfterBid < 0.001
                  ? '<0.001'
                  : priceRatioAfterBid.toFixed(4)}{' '}
                TGLD per {auction?.auctionTokenSymbol || 'TOKEN'}
              </ReceiveTextBottom>
            </ReceiveAmountContainer>
            {exceededAmount && (
              <WarningMessage>
                <MessageText>
                  <InfoCircle>
                    <p>i</p>
                  </InfoCircle>
                  <Text>
                    Amount exceeds {auction?.auctionTokenSymbol || 'TOKEN'}{' '}
                    auction limit.
                  </Text>
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
                  Current {auction?.auctionTokenSymbol || 'TOKEN'} price may
                  rise before the end of the auction.
                </Text>
              </MessageText>
              <MessageText>
                <LargeRoundCheckBox
                  checked={isCheckboxChecked2}
                  onToggle={handleCheckboxToggle2}
                />
                <Text>
                  Once submitted, bids cannot be withdrawn or canceled.
                </Text>
              </MessageText>
            </WarningMessage>
            <TradeButton
              style={{
                whiteSpace: 'nowrap',
                marginTop: '0px',
                alignSelf: 'center',
              }}
              onClick={handleBidClick}
              disabled={
                !inputValue ||
                Number(inputValue) <= 0 ||
                Number(inputValue) >
                  Number(
                    formatToken(balanceToken, TICKER_SYMBOL.TEMPLE_GOLD_TOKEN)
                  ) ||
                exceededAmount ||
                !isCheckboxChecked1 ||
                !isCheckboxChecked2 ||
                isSubmitting ||
                fadeEffect ||
                isLoadingUserMetrics
              }
            >
              SUBMIT BID
            </TradeButton>
          </>
        ) : (
          <TradeButton
            style={{ whiteSpace: 'nowrap', margin: '0px', alignSelf: 'center' }}
            onClick={() => {
              connect();
            }}
          >
            CONNECT WALLET
          </TradeButton>
        )}
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
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TempleGoldIcon = styled(templeGold)`
  width: 42px;
  height: 42px;
`;

const ReceiveAmountContainer = styled.div<{ fadeEffect?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};
  gap: 20px;
  padding: 16px;
  opacity: ${({ fadeEffect }) => (fadeEffect ? 0.5 : 1)};
  transition: opacity ${FADE_EFFECT_DURATION}ms ease-in-out;
`;

const ReceiveContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20px;
`;

const ReceiveTextTop = styled.div`
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

const ReceiveAmount = styled.h3<{ fadeEffect?: boolean }>`
  line-height: 52px;
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.gold};
  margin: 0px;
  opacity: ${({ fadeEffect }) => (fadeEffect ? 0.5 : 1)};
  transition: opacity ${FADE_EFFECT_DURATION}ms ease-in-out;
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
