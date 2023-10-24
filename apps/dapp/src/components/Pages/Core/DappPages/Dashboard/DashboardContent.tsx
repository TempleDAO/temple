import styled from 'styled-components';
import DashboardChart from './Chart';
import { StrategyKey } from './hooks/use-dashboardv2-metrics';
import DashboardMetrics from './Metrics';
import DashboardTransactionHistory from './Table';

export enum DashboardType {
  TREASURY_RESERVES_VAULT,
  RAMOS,
  TLC,
  TEMPLE_BASE,
  DSR_BASE,
}

type DashboardContentProps = {
  selectedDashboard?: DashboardType;
};

type DashboardData = {
  [key in DashboardType]: {
    title: string;
    description: string;
    chartStrategyNames: StrategyKey[];
  };
};

const DashboardContent = ({ selectedDashboard = DashboardType.TREASURY_RESERVES_VAULT }: DashboardContentProps) => {
  const dashboardData: DashboardData = {
    [DashboardType.TREASURY_RESERVES_VAULT]: {
      title: 'Treasury Reserves Vault',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',

      chartStrategyNames: [StrategyKey.TLC, StrategyKey.TEMPLEBASE, StrategyKey.RAMOS, StrategyKey.DSRBASE],
    },
    [DashboardType.RAMOS]: {
      title: 'RAMOS',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
      chartStrategyNames: [StrategyKey.RAMOS],
    },
    [DashboardType.TLC]: {
      title: 'TLC',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
      chartStrategyNames: [StrategyKey.TLC],
    },
    [DashboardType.TEMPLE_BASE]: {
      title: 'TempleBaseStrategy',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
      chartStrategyNames: [StrategyKey.TEMPLEBASE],
    },
    [DashboardType.DSR_BASE]: {
      title: 'DsrBaseStrategy',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
      chartStrategyNames: [StrategyKey.DSRBASE],
    },
  };

  const dashboard = dashboardData[selectedDashboard];

  return (
    <DashboardContentContainer>
      <Header>
        <HeaderTitle>{dashboard.title}</HeaderTitle>
        <HeaderText>{dashboard.description}</HeaderText>
      </Header>
      <DashboardChart dashboardType={selectedDashboard} strategyNames={dashboard.chartStrategyNames} />
      <DashboardMetrics dashboardType={selectedDashboard} />
      <DashboardTransactionHistory dashboardType={selectedDashboard} />
    </DashboardContentContainer>
  );
};

const HeaderText = styled.div`
  align-items: left;
`;

const HeaderTitle = styled.h2`
  font-size: 36px;
  color: ${(props) => props.theme.palette.brandLight};
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: left;
  width: 70vw;
`;

const DashboardContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export default DashboardContent;
