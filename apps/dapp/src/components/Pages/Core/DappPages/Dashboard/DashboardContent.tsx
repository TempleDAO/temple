import styled from 'styled-components';
import DashboardChart from './Chart';
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

const DashboardContent = ({ selectedDashboard = DashboardType.TREASURY_RESERVES_VAULT }: DashboardContentProps) => {
  const dashboardData = {
    [DashboardType.TREASURY_RESERVES_VAULT]: {
      title: 'Treasury Reserves Vault',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
      chartStrategyNames: ['TlcStrategy', 'TempleBaseStrategy', 'RamosStrategy', 'DsrBaseStrategy'],
    },
    [DashboardType.RAMOS]: {
      title: 'RAMOS',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
      chartStrategyNames: ['RamosStrategy'],
    },
    [DashboardType.TLC]: {
      title: 'TLC',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
      chartStrategyNames: ['TlcStrategy'],
    },
    [DashboardType.TEMPLE_BASE]: {
      title: 'TempleBaseStrategy',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
    },
    [DashboardType.DSR_BASE]: {
      title: 'DsrBaseStrategy',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
      chartStrategyNames: [],
    },
  };

  const dashboard = dashboardData[selectedDashboard]

  return (
    <DashboardContentContainer>
      <Header>
        <HeaderTitle>{dashboard.title}</HeaderTitle>
        <HeaderText>{dashboard.description}</HeaderText>
      </Header>
      <DashboardChart dashboardType={selectedDashboard} strategyNames={dashboard.chartStrategyNames}/>
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