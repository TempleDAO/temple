import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import DashboardChart from './Chart';
import DashboardMetrics from './Metrics';
import DashboardTransactionHistory from './Table';
import linkSvg from 'assets/icons/link.svg?react';
import { DashboardData, Dashboards } from './DashboardConfig';
import useDashboardV2Metrics from './hooks/use-dashboardv2-metrics';

type DashboardContentProps = {
  selectedDashboard?: DashboardData;
};

const DEFAULT_DASHBOARD = Dashboards[0];

const DashboardContent = ({
  selectedDashboard = DEFAULT_DASHBOARD,
}: DashboardContentProps) => {
  const { isShutdown } = useDashboardV2Metrics(selectedDashboard);

  return (
    <DashboardContentContainer>
      <Header>
        <HeaderTextContainer>
          <HeaderTitle>{selectedDashboard.title}</HeaderTitle>
          {isShutdown && <ShutdownBadge>Shutdown</ShutdownBadge>}
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
      <DashboardChart
        dashboardData={selectedDashboard}
        isShutdown={isShutdown}
      />
      {!isShutdown && <DashboardMetrics dashboardData={selectedDashboard} />}
      <DashboardTransactionHistory dashboardData={selectedDashboard} />
    </DashboardContentContainer>
  );
};

const ShutdownBadge = styled.div`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  color: ${({ theme }) => theme.palette.brand};
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  margin-right: 15px;
  white-space: nowrap;
  ${breakpoints.tabletAndAbove(`
    font-size: 14px;
    padding: 6px 16px;
  `)}
`;

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
