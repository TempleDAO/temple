import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import DashboardChart from './Chart';
import { StrategyKey } from './hooks/use-dashboardv2-metrics';
import DashboardMetrics from './Metrics';
import DashboardTransactionHistory from './Table';
import linkSvg from 'assets/icons/link.svg?react';
import env from 'constants/env';

export enum DashboardType {
  TREASURY_RESERVES_VAULT,
  RAMOS,
  // TLC, TODO: Hidden until launch
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
    link: string;
  };
};

const DashboardContent = ({ selectedDashboard = DashboardType.TREASURY_RESERVES_VAULT }: DashboardContentProps) => {
  const dashboardData: DashboardData = {
    [DashboardType.TREASURY_RESERVES_VAULT]: {
      title: 'Treasury Reserves Vault',
      description:
        'The Treasury Reserves Vault (TRV) is the source of capital for current Treasury allocations. When funding and Strategy parameters are approved, the TRV will transfer funds e.g. DAI to the deployed Strategy borrower. The current equity of the Strategy is discounted by the cost of capital whereby the Benchmark interest rate is set to match the current Base Strategy.',
      chartStrategyNames: [StrategyKey.TEMPLEBASE, StrategyKey.RAMOS, StrategyKey.DSRBASE],
      link: `${env.etherscan}/address/${env.contracts.treasuryReservesVault}`,
    },
    [DashboardType.RAMOS]: {
      title: 'Ramos',
      description:
        'Ramos is the automated market operations (AMO) manager that supplies liquidity to the TEMPLE/DAI pool on the Balancer Exchange platform. A bot manages the contract to support TEMPLE trading, reduce price volatility, and earn farming rewards.',
      chartStrategyNames: [StrategyKey.RAMOS],
      link: `${env.etherscan}/address/${env.contracts.strategies.ramosStrategy}`,
    },
    // TODO: Hidden until launch
    // [DashboardType.TLC]: {
    //   title: 'TLC',
    //   description:
    //     'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
    //   chartStrategyNames: [StrategyKey.TLC],
    // link: `${env.etherscan}/address/${env.contracts.strategies.tlcStrategy}`,
    // },
    [DashboardType.TEMPLE_BASE]: {
      title: 'Temple Base',
      description: 'The TEMPLE base strategy is not currently active.',
      chartStrategyNames: [StrategyKey.TEMPLEBASE],
      link: `${env.etherscan}/address/${env.contracts.strategies.templeStrategy}`,
    },
    [DashboardType.DSR_BASE]: {
      title: 'DSR Base',
      description:
        'Idle capital in the Treasury Reserve Vault (TRV) that is not currently deployed to a Strategy borrower will be automatically directed to a Base Strategy to earn yield. Currently, the Base Strategy is set to the Dai Savings Rate (DSR). The current rate of return for the Base Strategy also serves as the Benchmark interest rate for the Strategy borrower.',
      chartStrategyNames: [StrategyKey.DSRBASE],
      link: `${env.etherscan}/address/${env.contracts.strategies.dsrBaseStrategy}`,
    },
  };

  const dashboard = dashboardData[selectedDashboard];

  return (
    <DashboardContentContainer>
      <Header>
        <HeaderTextContainer>
          <HeaderTitle>{dashboard.title}</HeaderTitle>
          <LinkIcon onClick={() => window.open(dashboard.link, "_blank")}/>
        </HeaderTextContainer>
        <HeaderText>{dashboard.description}</HeaderText>
      </Header>
      <DashboardChart dashboardType={selectedDashboard} strategyNames={dashboard.chartStrategyNames} />
      <DashboardMetrics dashboardType={selectedDashboard} />
      <DashboardTransactionHistory dashboardType={selectedDashboard} />
    </DashboardContentContainer>
  );
};

const LinkIcon = styled(linkSvg)`
  fill:${({theme}) => theme.palette.brand};
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
