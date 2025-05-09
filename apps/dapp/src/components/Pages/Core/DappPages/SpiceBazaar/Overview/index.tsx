import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import linkSvg from 'assets/icons/link.svg?react';
import stakeTemple from 'assets/images/stake-temple.svg';
import goldAuctions from 'assets/images/gold-auctions.svg';
import spendTGDL from 'assets/images/spend-tgld.svg';
import liveGoldAuction from 'assets/icons/live-gold-auction.svg?react';
import { Button } from 'components/Button/Button';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone, queryMinTablet } from 'styles/breakpoints';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import { useEffect } from 'react';

export const Overview = () => {
  const navigate = useNavigate();
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const isTabletOrAbove = useMediaQuery({
    query: queryMinTablet,
  });
  const {
    daiGoldAuctionInfo: {
      data: daiGoldAuctionInfo,
      fetch: fetchDaiGoldAuctionInfo,
    },
  } = useSpiceBazaar();

  useEffect(() => {
    fetchDaiGoldAuctionInfo();
  }, [fetchDaiGoldAuctionInfo]);

  return (
    <PageContainer>
      <BodyContainer>
        <Header>
          <HeaderTitle>
            Spice Bazaar
            <LinkIcon
              onClick={() =>
                window.open(
                  'https://docs.templedao.link/spice-bazaar',
                  '_blank',
                  'noreferrer'
                )
              }
            />
          </HeaderTitle>
          <HeaderText>
            Temple Gold (TGLD) is the native currency of the Spice Bazaar. TGLD
            can be used to enter bids on{' '}
            {/* certain tokens from the Treasury offered {!isPhoneOrAbove && <br />} */}
            through periodic Auctions called Spice Auctions.{' '}
          </HeaderText>
          <HeaderText>
            Temple Gold is accessible to everyone. Even if you do not hold
            TEMPLE, you may directly enter USDS bids for TGLD through bi-weekly
            Gold Auctions. If you are a TEMPLE holder, simply stake TEMPLE for
            TGLD rewards every Epoch and use them in Spice Auctions.{' '}
          </HeaderText>
        </Header>
        <ContentContainer>
          <StakeContainer>
            <StakeContent>
              <StakeTitle>Stake TEMPLE for TGLD</StakeTitle>
              <StakeContentText>
                <StakeBody>
                  <StakeText>
                    <ListItem>
                      Temple Gold (TGLD) rewards will be distributed every Epoch
                      to staked TEMPLE tokens.
                    </ListItem>
                    <ListItem>
                      The TGLD reward rate for each Epoch depends on the number
                      of staked TEMPLE and the amount of TGLD in circulation.
                    </ListItem>
                    <ListItem>
                      Earned TGLD rewards can be used to bid in Spice Auctions.
                    </ListItem>
                    <ListItem>
                      Once staked, there will be a Cooldown before you can
                      unstake TEMPLE. <br />
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href="https://docs.templedao.link/spice-bazaar"
                      >
                        Learn more
                      </a>
                    </ListItem>
                  </StakeText>
                </StakeBody>
                <TradeButton
                  onClick={() => navigate('/dapp/spice/earn/staketemple/stake')}
                  style={{ whiteSpace: 'nowrap', margin: 0 }}
                >
                  Stake Temple for TGLD
                </TradeButton>
              </StakeContentText>
            </StakeContent>
            <StakeImg alt="Stake Temple" src={stakeTemple} />
          </StakeContainer>
          <AuctionsContainer>
            {isTabletOrAbove && (
              <AuctionsImg alt="Gold Auctions" src={goldAuctions} />
            )}
            <AuctionsContent>
              {daiGoldAuctionInfo?.currentEpochAuctionLive && (
                <AuctionsStatus>
                  <LiveAuctionIcon />
                  AN AUCTION IS LIVE
                </AuctionsStatus>
              )}
              <AuctionContentText>
                <AuctionBody>
                  <AuctionsTitle>
                    Bid USDS for TGLD {!isTabletOrAbove && <br />}
                    in Gold Auctions
                  </AuctionsTitle>
                  <AuctionsText>
                    <ListItem>
                      Bid USDS in a Gold Auction to earn TGLD for use in Spice
                      Auctions.
                    </ListItem>
                    <ListItem>
                      You do not need to hold TEMPLE to participate in a Gold
                      Auction.
                    </ListItem>
                    <ListItem>
                      There is no minimum reserve USDS price and you cannot be
                      outbid.
                    </ListItem>
                    <ListItem>
                      TGLD will be awarded pro rata to all USDS Bidders at the
                      end of the Gold Auction.
                    </ListItem>
                    <ListItem>
                      Once submitted, USDS bids cannot be withdrawn. <br />
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href="https://docs.templedao.link/spice-bazaar"
                      >
                        Learn more
                      </a>
                    </ListItem>
                  </AuctionsText>
                </AuctionBody>
                <TradeButton
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={() => navigate('/dapp/spice/bid')}
                >
                  Bid USDS For TGLD
                </TradeButton>
              </AuctionContentText>
              {!isTabletOrAbove && (
                <AuctionsImg alt="Gold Auctions" src={goldAuctions} />
              )}
            </AuctionsContent>
          </AuctionsContainer>
          <SpendContainer>
            <SpendContent>
              <SpendBody>
                <SpendTitle>
                  Spend TGLD for partner tokens <br /> (Spice Auctions)
                </SpendTitle>
                <SpendText>
                  <ListItem>
                    Spice Auctions provide a marketplace where you can spend
                    your earned Temple Gold (TGLD) to acquire valuable tokens
                    from the Temple Treasury. Interested buyers may enter a bid
                    for any amount of TGLD.
                  </ListItem>
                  <ListItem>
                    Each Spice Auction will have a fixed duration with no
                    reserve price.
                  </ListItem>
                  <ListItem>
                    Interested buyers may enter a bid for any amount of TGLD.
                  </ListItem>
                  <ListItem>
                    The final price for the token lot up for bidding will be
                    determined at the end of the auction once the last TGLD bid
                    has been received. <br />
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href="https://docs.templedao.link/spice-bazaar"
                    >
                      Learn more
                    </a>
                  </ListItem>
                </SpendText>
              </SpendBody>
              <TradeButton
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => navigate('/dapp/spice/spend')}
              >
                {' '}
                SPEND TGLD
              </TradeButton>
            </SpendContent>
            <SpendImg alt="Spend TGDL" src={spendTGDL} />
          </SpendContainer>
        </ContentContainer>
      </BodyContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  margin-top: -40px;
  display: flex;
  flex-direction: column;
  gap: 40px;
  max-width: 1000px;

  ${breakpoints.phoneAndAbove(`
    margin-top: -20px;
  `)}
`;

const BodyContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 60px;
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

  ${breakpoints.tabletAndAbove(`
    flex-direction: row;
  `)}
`;

const StakeContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
`;

const StakeContentText = styled.div`
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

const ListItem = styled.li`
  font-size: 16px;
  line-height: 24px;
  color: ${({ theme }) => theme.palette.brand};
  margin-bottom: 8px;
  &:last-child {
    margin-bottom: 0;
  }
  a {
    display: block;
    margin-top: 16px;
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
  justify-content: space-between;
  align-items: center;
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

const AuctionContentText = styled.div`
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

const AuctionsText = styled.ul`
  list-style-type: disc;
  padding-left: 20px;
  margin: 0px;

  & li::marker {
    color: ${({ theme }) => theme.palette.brand};
  }
`;

const TradeButton = styled(Button)`
  padding: 10px 20px 10px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: linear-gradient(90deg, #58321a 20%, #95613f 84.5%);
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px 0px #de5c0666;
  border-radius: 10px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const SpendContainer = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 32px;
  gap: 40px;
  justify-content: space-between;
  align-items: center;

  ${breakpoints.tabletAndAbove(`
    flex-direction: row;
    gap: 60px;
  `)}
`;

const SpendContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 40px;
  align-items: center;

  ${breakpoints.phoneAndAbove(`
    align-items: flex-start;
  `)}
`;

const SpendImg = styled.img`
  height: 270px;
  width: 280x;

  ${breakpoints.phoneAndAbove(`
    width: 350px;
    height: 362px;
  `)}
`;

const SpendBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SpendTitle = styled.h3`
  font-size: 20px;
  line-height: 37px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;

  ${breakpoints.phoneAndAbove(`
    text-align: left;
    font-size: 24px;
    line-height: 44px;
  `)}
`;

const SpendText = styled.div``;
