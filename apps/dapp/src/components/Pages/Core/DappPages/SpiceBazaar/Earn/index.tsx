import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import linkSvg from 'assets/icons/link.svg?react';
import stakeTemple from 'assets/images/stake-temple.svg';
import goldAuctions from 'assets/images/gold-auctions.svg';
import liveGoldAuction from 'assets/icons/live-gold-auction.svg?react';
import CircleLeft from 'assets/images/earn-circle-left.svg?react';
import CircleLeftMobile from 'assets/images/earn-circle-left-mobile.svg?react';
import CircleRight from 'assets/images/earn-circle-right.svg?react';
import { Button } from 'components/Button/Button';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

export const Earn = () => {
  const navigate = useNavigate();
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  return (
    <PageContainer>
      <Header>
        <HeaderTitle>
          Earn Temple Gold
          <LinkIcon />
        </HeaderTitle>
        <HeaderText>
          Temple Gold (TGLD) is the native currency of the Spice Bazaar. {!isPhoneOrAbove && <br />}
          TGLD can be used to enter bids on certain tokens from the Treasury {!isPhoneOrAbove && <br />}
          offered through periodic Auctions called Spice Auctions. {!isPhoneOrAbove && <br />}
        </HeaderText>
        <HeaderText>
          Temple Gold is accessible to everyone. If you do not {!isPhoneOrAbove && <br />}
          hold TEMPLE, You may directly enter USDS bids for {!isPhoneOrAbove && <br />}
          TGLD through bi-weekly Gold Auctions. If you are a {!isPhoneOrAbove && <br />}
          TEMPLE holder, simply stake TEMPLE for TGLD {!isPhoneOrAbove && <br />}
          rewards every Epoch and use them in Spice Auctions. {!isPhoneOrAbove && <br />} 
        </HeaderText>
      </Header>
      <ContentContainer>
        <StakeContainer>
          <StakeContent>
            <StakeTitle>Stake TEMPLE for TGLD</StakeTitle>
            {isPhoneOrAbove ? (
              <StakeContentImage />
            ) : (
              <StakeContentImageMobile />
            )}
            <StakeContentText>
              <StakeBody>
                <StakeText>
                  <StakeListItem>
                    Temple Gold (TGLD) rewards will be distributed every Epoch
                    to staked TEMPLE tokens.
                  </StakeListItem>
                  <StakeListItem>
                    The TGLD reward rate for each Epoch depends on the number of
                    staked TEMPLE and the amount of TGLD in circulation.
                  </StakeListItem>
                  <StakeListItem>
                    Earned TGLD rewards can be used to bid in Spice Auctions.
                  </StakeListItem>
                  <StakeListItem>
                    Once staked, there will be a Cooldown before you can unstake
                    TEMPLE. <span className="learn-more"> Learn More</span>
                  </StakeListItem>
                </StakeText>
              </StakeBody>
              <TradeButton
                onClick={() => navigate('staketemple/stake')}
                style={{ whiteSpace: 'nowrap', margin: 0 }}
              >
                Stake Temple for TGLD
              </TradeButton>
            </StakeContentText>
          </StakeContent>
          <StakeImg alt="Stake Temple" src={stakeTemple} />
        </StakeContainer>
        <AuctionsContainer>
          {isPhoneOrAbove && (
            <AuctionsImg alt="Gold Auctions" src={goldAuctions} />
          )}
          <AuctionsContent>
            <AuctionsStatus>
              <LiveAuctionIcon />
              AN AUCTION IS LIVE
            </AuctionsStatus>
            {isPhoneOrAbove ? (
              <AuctionContentImage />
            ) : (
              <AuctionContentImageMobile />
            )}
            <AuctionContentText>
              <AuctionBody>
                <AuctionsTitle>
                  Bid USDS for TGLD {!isPhoneOrAbove && <br />}
                  (Gold Auctions)
                </AuctionsTitle>
                <AuctionsText>
                  In a Temple Gold Auction, you may bid{' '}
                  {!isPhoneOrAbove && <br />} USDS to earn TGLD which can be
                  used to redeem volatile tokens in the Spice Auction. The more
                  USDS you bid, the more TGLD you will earn when the Temple Gold
                  Auction expires.
                </AuctionsText>
                <AuctionsText>
                  There is no minimum reserve price and the Auction unit price
                  for 1 TGLD will not be known until the last Bid has been
                  submitted.{' '}
                  <span className="submission">
                    Once submitted, USDS bids cannot be withdrawn.
                  </span>{' '}
                  <span className="learn-more"> Learn More</span>
                </AuctionsText>
              </AuctionBody>
              <TradeButton
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => navigate('auctions')}
              >
                Bid USDS For TGLD
              </TradeButton>
            </AuctionContentText>
            {!isPhoneOrAbove && (
              <AuctionsImg alt="Gold Auctions" src={goldAuctions} />
            )}
          </AuctionsContent>
        </AuctionsContainer>
      </ContentContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  margin-top: -20px;
  display: flex;
  flex-direction: column;
  gap: 80px;

  ${breakpoints.phoneAndAbove(`
    gap: 60px;
  `)}
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const HeaderTitle = styled.h2`
  display: flex;
  align-items: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
  gap: 15px;
  margin: 0px;
  font-size: 28px;
  line-height: 52px;

  ${breakpoints.phoneAndAbove(`
    font-size: 36px;
    line-height: 67px;
  `)}
`;

const LinkIcon = styled(linkSvg)`
  fill: ${({ theme }) => theme.palette.brand};
  cursor: pointer;
`;

const HeaderText = styled.div`
  font-size: 16px;
  line-height: 19px;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brand};

  ${breakpoints.phoneAndAbove(`
    font-size: 18px;
    line-height: 22px;
  `)}
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const StakeContainer = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  gap: 60px;
  padding: 32px;
  align-items: center;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const StakeContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
`;

const StakeContentImage = styled(CircleLeft)`
  position: absolute;
  top: 46px;
  left: 0;
  z-index: 0;
`;

const StakeContentImageMobile = styled(CircleLeftMobile)`
  position: absolute;
  top: 60px;
  left: 0;
  z-index: 0;
`;

const StakeContentText = styled.div`
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;

  ${breakpoints.phoneAndAbove(`
    align-items: flex-start;
  `)}
`;

const StakeBody = styled.div`
  display: flex;
  flex-direction: column;
`;

const StakeTitle = styled.h3`
  font-size: 20px;
  line-height: 37px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
  text-align: center;

  ${breakpoints.phoneAndAbove(`
    text-align: left;
    font-size: 24px;
    line-height: 44px;
  `)}
`;

const StakeText = styled.ul`
  list-style-type: disc;
  padding-left: 20px;
  margin: 0px;

  & li::marker {
    color: ${({ theme }) => theme.palette.brand};
  }
`;

const StakeListItem = styled.li`
  font-size: 16px;
  line-height: 24px;
  color: ${({ theme }) => theme.palette.brand};
  margin-bottom: 8px;
  &:last-child {
    margin-bottom: 0;
  }
  .learn-more {
    font-weight: 700;
    text-decoration: underline;
    font-size: 13px;
    line-height: 20px;
  }

  ${breakpoints.phoneAndAbove(`
    line-height: 20px;
  `)}
`;

const StakeImg = styled.img`
  width: 275px;
  height: 245px;

  ${breakpoints.phoneAndAbove(`
    width: 390px;
    height: 345px;
  `)}
`;

const AuctionsContainer = styled.div`
  display: flex;
  flex-direction: row;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 32px;
`;

const AuctionsContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  gap: 40px;

  ${breakpoints.phoneAndAbove(`
    gap: 20px;
`)}
`;

const AuctionContentImage = styled(CircleRight)`
  position: absolute;
  top: 40px;
  right: 0px;
  z-index: 0;
`;

const AuctionContentImageMobile = styled(CircleLeftMobile)`
  position: absolute;
  top: 60px;
  left: 0;
  z-index: 0;
`;

const AuctionContentText = styled.div`
  z-index: 1;
  display: flex;
  flex-direction: column;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;

  ${breakpoints.phoneAndAbove(`
    align-items: flex-start;
  `)}
`;

const AuctionBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const AuctionsStatus = styled.div`
  display: flex;
  width: 170px;
  flex-direction: row;
  align-self: center;
  justify-content: space-between;
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brandLight};
  padding: 8px;
  border: 1px solid ${({ theme }) => theme.palette.brandLight};
  border-radius: 10px;

  ${breakpoints.phoneAndAbove(`
    align-self: flex-end;
`)}
`;

const AuctionsImg = styled.img`
  width: 271px;
  height: 310px;
`;

const LiveAuctionIcon = styled(liveGoldAuction)`
  width: '17px';
  height: '17px';
`;

const AuctionsTitle = styled.h3`
  font-size: 20px;
  line-height: 37px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
  text-align: center;

  ${breakpoints.phoneAndAbove(`
    text-align: left;
    font-size: 24px;
    line-height: 44px;
  `)}
`;

const AuctionsText = styled.div`
  font-size: 16px;
  line-height: 24px;
  color: ${({ theme }) => theme.palette.brand};
  text-align: center;
  .submission {
    font-weight: 700;
  }
  .learn-more {
    font-weight: 700;
    text-decoration: underline;
    font-size: 13px;
    line-height: 20px;
  }

  ${breakpoints.phoneAndAbove(`
    line-height: 20px;
    text-align: left;
  `)}
`;

const TradeButton = styled(Button)`
  padding: 10px 20px 10px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  line-height: 18px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;
