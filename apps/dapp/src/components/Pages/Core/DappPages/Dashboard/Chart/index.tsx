import styled from 'styled-components';
import { DashboardType } from '../DashboardContent';
import { TemplePriceChart } from './PriceChart';

type DashboardChartProps = {
  dashboardType: DashboardType;
};

const DashboardChart = ({ dashboardType }: DashboardChartProps) => {
  // TODO: Based on the dashboardType, we need to fetch and render the right data
  console.debug('DashboardChart with dashboardType: ', dashboardType);
  
  return (
    <>
      <ChartContainer>
        {/* // TODO: This price chart needs updated with the right data */}
        {/* // And also fixed to be the proper width */}
        <TemplePriceChart />
      </ChartContainer>
    </>
  );
};

export default DashboardChart;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 1rem 0;
  width: 70vw;
`;

const CurrencyOption = styled.div`
  display: flex;
  flex-direction: row;
  padding: 10px;
`;

const BaseCurrencySelectorContainer = styled.div`
  display: flex;
  width: 100%;
`;

const BaseCurrencyTitle = styled.div`
  color: ${(props) => props.theme.palette.brand};
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const BaseCurrencyContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  margin: 20px;
`;
