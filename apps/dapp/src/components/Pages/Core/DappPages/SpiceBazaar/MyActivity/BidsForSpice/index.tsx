import styled from 'styled-components';
import { MyActivityTopNav } from '../TopNav';
import linkSvg from 'assets/icons/link.svg?react';
import { BidHistory } from './Tables/BidTable';
import { TransactionsHistory } from './Tables/TransactionsTable';
import { Button } from 'components/Button/Button';
import * as breakpoints from 'styles/breakpoints';
import { useMyActivityRedeemAmountSpice } from './hooks/use-myActivity-redeemAmount';
import Loader from 'components/Loader/Loader';
import { useMemo } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { useSpiceAuction } from 'providers/SpiceAuctionProvider';
import { formatNumberWithCommasAndDecimals } from 'utils/formatter';

export const MyActivitySpice = () => {
  const redeemAmount = useMyActivityRedeemAmountSpice();

  const { currentUser } = useSpiceAuction();
  const {
    data: { unclaimedAmount },
    loading: currentUserMetricsLoading,
  } = currentUser;

  const { wallet } = useWallet();
  // if wallet is not connected, set redeemAmount to 0
  const redeemAmountIfConnected = useMemo(() => {
    if (!wallet) return '0';
    return redeemAmount;
  }, [wallet, redeemAmount]);

  const unclaimedAmountIfConnected = useMemo(() => {
    if (!wallet) return '0';

    if (currentUserMetricsLoading) return '0';

    return unclaimedAmount;
  }, [wallet, unclaimedAmount, currentUserMetricsLoading]);

  return (
    <PageContainer>
      <MyActivityTopNav />
      <Title>
        <TitleText>Bids for Spice</TitleText>
        <LinkIcon
          onClick={() =>
            window.open(
              'https://docs.templedao.link/spice-bazaar',
              '_blank',
              'noreferrer'
            )
          }
        />
      </Title>
      <ContentContainer>
        <StatusContainer>
          <BalanceBox>
            {redeemAmountIfConnected !== null ? (
              <>
                <StatusValue>{redeemAmountIfConnected}</StatusValue>
                <StatusText>Total Redeemed TGLD</StatusText>
              </>
            ) : (
              <Loader iconSize={32} />
            )}
          </BalanceBox>
          <BalanceBox>
            <Status>
              {unclaimedAmountIfConnected !== null &&
              !currentUserMetricsLoading ? (
                <>
                  <StatusValue>
                    {formatNumberWithCommasAndDecimals(
                      unclaimedAmountIfConnected
                    )}
                  </StatusValue>
                  <StatusText>Unclaimed Rewards</StatusText>
                </>
              ) : (
                <Loader iconSize={32} />
              )}
            </Status>
            {/* <TradeButton
              style={{
                whiteSpace: "nowrap",
                marginTop: "0px",
                padding: "10px 20px 10px 20px",
                width: "150px",
              }}
              onClick={() => console.log("clicked")}
            >
              Claim
            </TradeButton> */}
          </BalanceBox>
        </StatusContainer>
        <TablesContainer>
          <BidHistory />
          <TransactionsHistory />
        </TablesContainer>
      </ContentContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  margin-top: -40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
  z-index: 1;

  ${breakpoints.phoneAndAbove(`
    margin-top: -20px;
    gap: 40px;
  `)}
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 60px;
`;

const Title = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 15px;
`;

const TitleText = styled.h2`
  color: ${({ theme }) => theme.palette.brandLight};
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

const StatusContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    gap: 20px;  
  `)}
`;

const BalanceBox = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  flex-basis: 0;
  justify-content: center;
  align-items: center;
  min-height: 140px;
  padding: 20px 10px 20px 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  gap: 12px;
  background: linear-gradient(180deg, #0b0a0a 0%, #1d1a1a 100%);

  ${breakpoints.phoneAndAbove(`
      padding: 30px 20px 20px 20px;
      justify-content: center;
      background: none;
      height: 180px;
      gap: 20px;
    `)}
`;

const UnclaimedBox = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  flex-basis: 0;
  justify-content: center;
  align-items: center;
  min-height: 190px;
  padding: 20px 10px 20px 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  gap: 20px;
  background: linear-gradient(180deg, #0b0a0a 0%, #1d1a1a 100%);

  ${breakpoints.phoneAndAbove(`
    padding: 10px 20px 0px 20px;
    background: none;
    min-height: 180px;
  `)}
`;

const StatusValue = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 24px;
  font-weight: 700;
  line-height: 29px;
`;

const StatusText = styled.div`
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
  line-height: 19px;
  text-align: center;
`;

const Status = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 15px;
`;

const TablesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0px;

  ${breakpoints.phoneAndAbove(`
    gap: 80px;
  `)}
`;

const TradeButton = styled(Button)`
  padding: 10px 20px 10px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 1px solid ${({ theme }) => theme.palette.brandDark}; //if button is not active this is not used
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4); //if button is not active this is not used
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  line-height: 18px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;
