import styled from 'styled-components';
import { MyActivityTopNav } from '../TopNav';
import linkSvg from 'assets/icons/link.svg?react';
import { BidHistory } from './Tables/BidTable';
import { TransactionsHistory } from './Tables/TransactionsTable';
import { Button } from 'components/Button/Button';
import * as breakpoints from 'styles/breakpoints';
import { useWallet } from 'providers/WalletProvider';
import Loader from 'components/Loader/Loader';
import { formatNumberWithCommas, formatToken } from 'utils/formatter';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useEffect, useMemo } from 'react';

export const MyActivityTGLD = () => {
  const { balance, updateBalance, wallet } = useWallet();
  const {
    daiGoldAuctionInfo,
    daiGoldAuctions: { claim: daiGoldAuctionClaim },
    currentUser: {
      data: currentUserMetrics,
      loading: currentUserMetricsLoading,
      fetch: fetchCurrentUserMetrics,
    },
  } = useSpiceBazaar();

  const {
    data: daiGoldAuctionInfoData,
    loading: daiGoldAuctionInfoLoading,
    fetch: fetchDaiGoldAuctionInfo,
  } = daiGoldAuctionInfo;

  useEffect(() => {
    const onMount = async () => {
      await Promise.all([
        updateBalance(),
        fetchDaiGoldAuctionInfo(),
        fetchCurrentUserMetrics(),
      ]);
    };
    onMount();
  }, [wallet]);

  const shouldShowUnclaimedLastEpoch = useMemo(
    () =>
      daiGoldAuctionInfoData.currentEpoch !== 1 &&
      currentUserMetrics.previousEpochRewards > 0,
    [
      daiGoldAuctionInfoData.currentEpoch,
      currentUserMetrics.previousEpochRewards,
    ]
  );

  return (
    <PageContainer>
      <MyActivityTopNav />
      <Title>
        <TitleText>Bids for TGLD</TitleText>
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
            <StatusValue>
              {balance.TGLD
                ? formatNumberWithCommas(
                    formatToken(balance.TGLD, TICKER_SYMBOL.TEMPLE_GOLD_TOKEN)
                  )
                : '0'}
            </StatusValue>
            <StatusText>Wallet Balance (TGLD)</StatusText>
          </BalanceBox>
          <UnclaimedBox>
            {currentUserMetricsLoading || daiGoldAuctionInfoLoading ? (
              <Loader iconSize={32} />
            ) : (
              <>
                {!shouldShowUnclaimedLastEpoch ? (
                  <Status>
                    <StatusValue>0</StatusValue>
                    <StatusText>
                      No unclaimed TGLD from previous epoch
                    </StatusText>
                  </Status>
                ) : (
                  <Status>
                    <>
                      <StatusValue>
                        {formatNumberWithCommas(
                          currentUserMetrics.previousEpochRewards
                        )}
                        &nbsp;TGLD
                      </StatusValue>
                      <StatusText>
                        Unclaimed TGLD From Epoch{' '}
                        {daiGoldAuctionInfoData.currentEpoch - 1}
                      </StatusText>
                    </>
                  </Status>
                )}
              </>
            )}
            <TradeButton
              style={{
                whiteSpace: 'nowrap',
                marginTop: '0px',
                padding: '10px 20px 10px 20px',
                width: '150px',
              }}
              disabled={!shouldShowUnclaimedLastEpoch}
              onClick={async () => {
                await daiGoldAuctionClaim(
                  daiGoldAuctionInfoData.currentEpoch - 1
                );
                await fetchCurrentUserMetrics();
              }}
            >
              Claim
            </TradeButton>
          </UnclaimedBox>
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
    justify-content: flex-start;
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
    padding: 30px 20px 0px 20px;
    justify-content: flex-start;
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
  padding: 10px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: ${({ disabled, theme }) =>
    disabled ? 'none' : `1px solid ${theme.palette.brandDark}`};
  box-shadow: ${({ disabled }) =>
    disabled ? 'none' : '0px 0px 20px 0px rgba(222, 92, 6, 0.4)'};
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  line-height: 20px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;
