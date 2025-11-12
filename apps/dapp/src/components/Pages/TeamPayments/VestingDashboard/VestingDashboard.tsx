import { ProjectedTGLDVesting } from 'components/Pages/TeamPayments/VestingDashboard/Chart/Chart';
import { ClaimHistory } from 'components/Pages/TeamPayments/VestingDashboard/Tables/ClaimHistoryTable';
import styled from 'styled-components';
import { SearchInput } from './components/Input';
import { useState } from 'react';
import { AllDatesDropdown } from './components/InputSelect';
import { useVestingMetrics } from './hooks/use-vesting-metrics';
import { useAddressValidation } from './hooks/use-address-validation';
import Loader from 'components/Loader/Loader';

interface MetricBoxProps {
  value: number;
  title: string;
  loading: boolean;
}

function MetricBox({ value, title, loading }: MetricBoxProps) {
  return (
    <Box>
      {loading ? (
        <Loader iconSize={32} />
      ) : (
        <>
          <Sum>{value.toLocaleString()}</Sum>
          <Title>{title}</Title>
        </>
      )}
    </Box>
  );
}

export default function VestingDashboard() {
  const [searchValue, setSearchValue] = useState('');

  // Validate search address
  const addressValidation = useAddressValidation(searchValue);

  // Fetch vesting metrics (global or filtered by validated address)
  const {
    data: metrics,
    loading,
    error,
  } = useVestingMetrics(addressValidation.validatedAddress ?? undefined);

  const totalClaimable = metrics?.totalVestedAndUnclaimed || 0;
  const totalClaimed = metrics?.totalReleased || 0;

  return (
    <PageContainer>
      <SearchBar>
        <SearchInput value={searchValue} onChange={setSearchValue} />
      </SearchBar>
      <HeaderTitle>Vesting Dashboard</HeaderTitle>
      {/* <AllDatesDropdown /> */}
      <StatusContainer>
        <BoxContainer>
          <MetricBox
            value={totalClaimable}
            title="Total TGLD Vested / Claimable"
            loading={loading}
          />
          <MetricBox
            value={totalClaimed}
            title="Total TGLD Claimed"
            loading={loading}
          />
        </BoxContainer>
      </StatusContainer>
      <ProjectedTGLDVesting
        walletAddress={addressValidation.validatedAddress ?? undefined}
      />
      <ClaimHistory
        walletAddress={addressValidation.validatedAddress ?? undefined}
      />
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

const SearchBar = styled.div`
  display: flex;
  justify-content: flex-end;
  width: 100%;
`;
