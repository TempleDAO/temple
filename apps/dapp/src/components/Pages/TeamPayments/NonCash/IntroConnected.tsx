import { useState } from 'react';
import styled from 'styled-components';
import { Chart } from 'components/Pages/TeamPayments/NonCash/Chart/Chart';
import { ClaimableTGLD } from 'components/Pages/TeamPayments/NonCash/Tables/ClaimableTable';
import { ClaimHistory } from 'components/Pages/TeamPayments/NonCash/Tables/ClaimHistoryTable';
import { GlobalChartStyles } from 'components/Pages/TeamPayments/NonCash/Chart/LineChart';
import InfoCircle from 'assets/icons/infocircle.svg?react';

export default function IntroConnected() {
  const [hasClaimed, setHasClaimed] = useState(false);
  const [active, setActive] = useState<'current' | 'previous'>('current');

  return (
    <PageContainer>
      <HeaderTitle>Non-Cash Compensation</HeaderTitle>
      <Filter>
        <ToggleButton
          active={active === 'current'}
          onClick={() => setActive('current')}
        >
          Current
        </ToggleButton>
        <ToggleButton
          active={active === 'previous'}
          onClick={() => setActive('previous')}
        >
          Previous
        </ToggleButton>
      </Filter>
      <StatusContainer>
        <BoxContainer>
          <Box>
            <Sum>1,000,000</Sum>
            <Title>
              Total TGLD Reward
              <InfoIcon />
            </Title>
          </Box>
          <Box>
            <Sum>500,000</Sum>
            <Title>Unvested TGLD</Title>
          </Box>
        </BoxContainer>
        <BoxContainer>
          <Box>
            <Sum>500,000</Sum>
            <Title>Vested TGLD</Title>
          </Box>
          <Box onClick={() => setHasClaimed(!hasClaimed)}>
            <Sum>{hasClaimed ? '0' : '45,213'}</Sum>
            <Title>
              Unclaimed TGLD
              <InfoIcon />
            </Title>
          </Box>
        </BoxContainer>
      </StatusContainer>
      <ChartContainer>
        <GlobalChartStyles />
        <ChartTitle>Your Vests</ChartTitle>
        <Chart />
      </ChartContainer>
      {!hasClaimed && <ClaimableTGLD />}
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
t ext-decoration-color: ${({ theme }) =>
  theme.palette.brandLight};  font-size: 16px;
  line-height: 19px;
  cursor: pointer;
  padding: 0;
  outline: none;
`;
