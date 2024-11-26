import styled from 'styled-components';
import { TradeButton } from './Stake';
import templeGold from 'assets/icons/temple-gold.svg?react';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import { formatNumberWithCommas } from 'utils/formatter';
import Loader from 'components/Loader/Loader';

export const Claim = () => {
  const {
    stakePageMetrics: {
      data: stakePageMetricsData,
      loading: stakePageMetricsLoading,
    },
    staking: { claimRewards },
  } = useSpiceBazaar();

  const hasRewards = stakePageMetricsData.yourRewards > 0;

  return (
    <PageContainer>
      <AvailableAmountContainer>
        {stakePageMetricsLoading ? (
          <Loader iconSize={32} />
        ) : (
          <>
            <TempleGoldIcon />
            <AvailableAmountText>
              <AvailableAmount>
                {formatNumberWithCommas(stakePageMetricsData.yourRewards)} TGLD
              </AvailableAmount>
              <AvailabilityText>AVAILABLE</AvailabilityText>
            </AvailableAmountText>
          </>
        )}
      </AvailableAmountContainer>
      {stakePageMetricsLoading ? (
        <LoaderContainer>
          <Loader iconSize={32} />
        </LoaderContainer>
      ) : (
        <TradeButton
          style={{ whiteSpace: 'nowrap', marginTop: 0 }}
          onClick={claimRewards}
          disabled={!hasRewards}
        >
          CLAIM
        </TradeButton>
      )}
    </PageContainer>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 10px 32px 10px;
  gap: 24px;
`;

const AvailableAmountContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px 24px 0px 24px;
  gap: 15px;
  width: 450px;
`;

const TempleGoldIcon = styled(templeGold)``;

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

const AvailabilityText = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
`;

const LoaderContainer = styled.div`
  height: 43px; // Match the height of the TradeButton
  display: flex;
  align-items: center;
  justify-content: center;
`;
