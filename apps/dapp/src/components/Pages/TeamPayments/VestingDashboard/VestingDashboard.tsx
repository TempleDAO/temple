import { ProjectedTGLDVesting } from 'components/Pages/TeamPayments/VestingDashboard/Chart/Chart';
import { ClaimHistory } from 'components/Pages/TeamPayments/VestingDashboard/Tables/ClaimHistoryTable';
import styled from 'styled-components';
import { SearchInput } from './components/Input';
import { useState } from 'react';
import { AllDatesDropdown } from './components/InputSelect';

export default function VestingDashboard() {
  const [searchValue, setSearchValue] = useState('');

  return (
    <PageContainer>
      <SearchBar>
        <SearchInput value={searchValue} onChange={setSearchValue} />
      </SearchBar>
      <HeaderTitle>Vesting Dashboard</HeaderTitle>
      <AllDatesDropdown />
      <StatusContainer>
        <BoxContainer>
          <Box>
            <Sum>1,000,000</Sum>
            <Title>Total TGLD Vested / Claimable</Title>
          </Box>
          <Box>
            <Sum>500,000</Sum>
            <Title>Total TGLD Claimed</Title>
          </Box>
        </BoxContainer>
      </StatusContainer>
      <ProjectedTGLDVesting />
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

const SearchBar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
`;
