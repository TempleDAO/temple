import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import DashboardChart from './Chart';
import DashboardMetrics from './Metrics';
import DashboardTransactionHistory from './Table';
import linkSvg from 'assets/icons/link.svg?react';
import { DashboardData, Dashboards } from './DashboardConfig';

type DashboardContentProps = {
  selectedDashboard?: DashboardData;
};

const DEFAULT_DASHBOARD = Dashboards[0];

const DashboardContent = ({
  selectedDashboard = DEFAULT_DASHBOARD,
}: DashboardContentProps) => {
  return (
    <DashboardContentContainer>
      <Header>
        <HeaderTextContainer>
          <HeaderTitle>{selectedDashboard.title}</HeaderTitle>
          <LinkIcon
            onClick={() =>
              window.open(selectedDashboard.contractLink, '_blank')
            }
          />
        </HeaderTextContainer>
        <HeaderText
          dangerouslySetInnerHTML={{ __html: selectedDashboard.description }}
        />
      </Header>
      <DashboardChart dashboardData={selectedDashboard} />
      <DashboardMetrics dashboardData={selectedDashboard} />
      <DashboardTransactionHistory dashboardData={selectedDashboard} />
    </DashboardContentContainer>
  );
};

const LinkIcon = styled(linkSvg)`
  fill: ${({ theme }) => theme.palette.brand};
  cursor: pointer;
`;

const HeaderTextContainer = styled.div`
  display: flex;
  align-items: center;
`;

const HeaderText = styled.div`
  align-items: left;
  display: block;
  font-size: 12px;
  color: ${({ theme }) => theme.palette.brand};
  ${breakpoints.phoneAndAbove(`
    font-size: 16px;
  `)}
`;

const HeaderTitle = styled.h2`
  color: ${(props) => props.theme.palette.brandLight};
  font-size: 24px;
  margin: 0;
  margin-right: 15px;
  ${breakpoints.tabletAndAbove(`
    font-size: 36px;
  `)}
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: left;
`;

const DashboardContentContainer = styled.div`
  display: flex;
  gap: 30px;
  flex-direction: column;
  width: 100%;
`;

export default DashboardContent;
