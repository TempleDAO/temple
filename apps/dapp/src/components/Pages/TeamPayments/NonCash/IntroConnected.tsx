import { useState } from 'react';
import styled from 'styled-components';
import { Chart } from 'components/Pages/TeamPayments/NonCash/Chart/Chart';
import { ClaimableTGLD } from 'components/Pages/TeamPayments/NonCash/Tables/ClaimableTable';
import { ClaimHistory } from 'components/Pages/TeamPayments/NonCash/Tables/ClaimHistoryTable';
import { GlobalChartStyles } from 'components/Pages/TeamPayments/NonCash/Chart/LineChart';
import { useVestingMetrics } from 'components/Pages/TeamPayments/NonCash/hooks/use-vesting-metrics';
import Loader from 'components/Loader/Loader';
import InfoCircle from 'assets/icons/infocircle.svg?react';

export default function IntroConnected() {
  const [hasClaimed, setHasClaimed] = useState(false);
  const [active, setActive] = useState<'current' | 'previous'>('current');

  // Fetch all vesting data from subgraph
  const { schedules, totalAllocated, totalVested, totalReleased, loading } =
    useVestingMetrics();

  // Calculate metrics from subgraph data
  const totalUnvested = Math.max(0, totalAllocated - totalVested);
  const totalClaimable = Math.max(0, totalVested - totalReleased);

  return (
    <PageContainer>
      <HeaderTitle>Non-Cash Compensation</HeaderTitle>
      {/* Disabled Filter for now */}
      {/* <Filter>
        <ToggleButton active={active === "current"} onClick={() => setActive("current")}>
          Current
        </ToggleButton>
        <ToggleButton active={active === "previous"} onClick={() => setActive("previous")}>
          Previous
        </ToggleButton>
      </Filter> */}
      <StatusContainer>
        <BoxContainer>
          <Box>
            {loading ? (
              <Loader iconSize={32} />
            ) : (
              <>
                <Sum>{totalAllocated.toLocaleString()}</Sum>
                <Title>
                  Total TGLD Reward
                  <InfoIcon />
                </Title>
              </>
            )}
          </Box>
          <Box>
            {loading ? (
              <Loader iconSize={32} />
            ) : (
              <>
                <Sum>{totalUnvested.toLocaleString()}</Sum>
                <Title>Unvested TGLD</Title>
              </>
            )}
          </Box>
        </BoxContainer>
        <BoxContainer>
          <Box>
            {loading ? (
              <Loader iconSize={32} />
            ) : (
              <>
                <Sum>{totalVested.toLocaleString()}</Sum>
                <Title>Vested TGLD</Title>
              </>
            )}
          </Box>
          <Box onClick={() => setHasClaimed(!hasClaimed)}>
            {loading ? (
              <Loader iconSize={32} />
            ) : (
              <>
                <Sum>{hasClaimed ? '0' : totalClaimable.toLocaleString()}</Sum>
                <Title>
                  Unclaimed TGLD
                  <InfoIcon />
                </Title>
              </>
            )}
          </Box>
        </BoxContainer>
      </StatusContainer>
      <ChartContainer>
        <GlobalChartStyles />
        <ChartTitle>Your Vests</ChartTitle>
        <Chart />
      </ChartContainer>
      {totalClaimable > 0 && <ClaimableTGLD />}
      <ClaimHistory />
    </PageContainer>
  );
}

const PageContainer = styled.div`
  margin-top: -40px;
  display: flex;
  flex-direction: column;
  gap: 40px;
  padding: 40px 0px 0px 0px;
`;

const HeaderTitle = styled.h2`
  display: flex;
  align-items: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
  gap: 15px;
  margin: 0px;
  font-size: 36px;
`;

const StatusContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const BoxContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  flex-basis: 0;
  min-height: 136px;
  gap: 12px;
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: linear-gradient(to bottom, #0b0a0a, #1d1a1a);
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
`;

const Sum = styled.div`
  font-size: 24px;
  font-weight: 700;
  line-height: 29px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const ChartTitle = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 24px;
`;

const InfoIcon = styled(InfoCircle)`
  width: 24px;
  height: 24px;
`;

const Filter = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 40px;
  padding: 0px 20px;
`;

const ToggleButton = styled.button<{ active: boolean }>`
  background: none;
  border: none;
  color: ${({ active, theme }) =>
    active ? theme.palette.brandLight : theme.palette.brand};
  text-decoration: ${({ active }) => (active ? 'underline' : 'none')};
  text-decoration-color: ${({ theme }) => theme.palette.brandLight};
  font-size: 16px;
  line-height: 19px;
  cursor: pointer;
  padding: 0;
  outline: none;
`;
