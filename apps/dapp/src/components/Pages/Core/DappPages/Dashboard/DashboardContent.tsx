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
  TLC,
  TEMPLE_BASE,
  DSR_BASE,
  TEMPLO_MAYOR_GNOSIS,
  FOHMO_GNOSIS,
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
        'Treasury Reserves Vault (TRV) coordinates and manages the flow of capital for current Treasury allocations. When funding and management parameters are approved for a Strategy, the TRV will transfer funds e.g. DAI and issue corresponding debt to the Strategy borrower. The current equity of the Strategy is discounted by the loan principal and accrued interest benchmarked to the prevailing rate of the current Base Strategy for the borrowed token.',
      chartStrategyNames: [
        StrategyKey.TEMPLEBASE,
        StrategyKey.RAMOS,
        StrategyKey.DSRBASE,
        StrategyKey.TEMPLO_MAYOR_GNOSIS,
        StrategyKey.FOHMO_GNOSIS,
      ],
      link: `${env.etherscan}/address/${env.contracts.treasuryReservesVault}`,
    },
    [DashboardType.RAMOS]: {
      title: 'Ramos',
      description:
        'Ramos is the automated market operations (AMO) manager that supplies liquidity to the TEMPLE/DAI pool on the Balancer Exchange platform. A bot manages the contract to support TEMPLE trading, reduce price volatility, and earn farming rewards.',
      chartStrategyNames: [StrategyKey.RAMOS],
      link: `${env.etherscan}/address/${env.contracts.strategies.ramosStrategy}`,
    },
    [DashboardType.TLC]: {
      title: 'TLC',
      description:
        'Temple Loving Care (also known as Temple Line of Credit) offers DAI lending for users who supply TEMPLE token as collateral. The value of the collateral is not determined by the current $TEMPLE spot price on the Balancer DEX but by the current Treasury Price Index (TPI). Users may borrow up to 75% loan-to-value (LTV) with the liquidation LTV set to 80%. There are no origination fees and users can withdraw their collateral at any time by repaying the DAI loan. TLC interest rate is a variable APR that is dependent on Debt Ceiling Utilisation. Any accrued interest will increase LTV over time. Borrowers can expect the APR to be set no lower than the prevailing APR for the Treasury DAI Base Strategy. <a target="_blank" href="https://templedao.medium.com/he-who-controls-the-spice-controls-the-universe-bae5fb92bd43">Click here</a> to learn more about Temple Loving Care.',
      chartStrategyNames: [StrategyKey.TLC],
      link: `${env.etherscan}/address/${env.contracts.strategies.tlcStrategy}`,
    },
    [DashboardType.TEMPLE_BASE]: {
      title: 'Temple Base',
      description:
        'Temple Base strategy is the source of automated market operations (AMO) TEMPLE tokens in the Treasury framework. The TRV facilitates the withdrawal of newly minted TEMPLE tokens from and the issuance of TEMPLE debt to the Temple Base strategy. These TEMPLE tokens will be borrowed by a Treasury Strategy such as Ramos to generate returns. Once these tokens are repaid to the TRV, they will be deposited to the Temple Base strategy to be burned. From the perspective of the TRV, positive returns will be realized when TEMPLE flows to the Temple Base strategy is net positive.',
      chartStrategyNames: [StrategyKey.TEMPLEBASE],
      link: `${env.etherscan}/address/${env.contracts.strategies.templeStrategy}`,
    },
    [DashboardType.DSR_BASE]: {
      title: 'DSR Base',
      description:
        'Idle capital in the Treasury Reserves Vault (TRV) that is not currently deployed to a Strategy borrower will be automatically directed to a Base Strategy to earn yield. Currently, the Base Strategy is set to the Dai Savings Rate (DSR) which makes DAI the base currency of the TRV. The current rate of return for DSR Base also serves as the benchmark interest rate for the Treasury Strategy that borrows DAI from the TRV.',
      chartStrategyNames: [StrategyKey.DSRBASE],
      link: `${env.etherscan}/address/${env.contracts.strategies.dsrBaseStrategy}`,
    },
    [DashboardType.TEMPLO_MAYOR_GNOSIS]: {
      title: 'Templo Mayor',
      description:
        'Templo Mayor is an Gnosis Safe Omnibus strategy. An Omnibus Strategy utilises the same bookkeeping structure and approval process, but may entail several related holdings or sub-positions that are managed as a whole. For instance, deposits into different but similar or co-dependent vaults on the same platform or different platforms may be consolidated into one Omnibus Gnosis Safe. Seed allocations of a target risk profile may also be consolidated into an Omnibus Strategy to reduce the noise. Therefore an Omnibus Strategy may provide additional operational efficiency and allow Stakeholders to evaluate a series of related deployments as one composite position rather than as singletons.',
      chartStrategyNames: [StrategyKey.TEMPLO_MAYOR_GNOSIS],
      link: `${env.etherscan}/address/${env.contracts.strategies.temploMayorGnosisStrategy}`,
    },
    [DashboardType.FOHMO_GNOSIS]: {
      title: 'Fohmo',
      description: '',
      chartStrategyNames: [StrategyKey.FOHMO_GNOSIS],
      link: `${env.etherscan}/address/${env.contracts.strategies.fohmoGnosisStrategy}`,
    },
  };

  const dashboard = dashboardData[selectedDashboard];

  return (
    <DashboardContentContainer>
      <Header>
        <HeaderTextContainer>
          <HeaderTitle>{dashboard.title}</HeaderTitle>
          <LinkIcon onClick={() => window.open(dashboard.link, '_blank')} />
        </HeaderTextContainer>
        <HeaderText dangerouslySetInnerHTML={{ __html: dashboard.description }} />
      </Header>
      <DashboardChart dashboardType={selectedDashboard} strategyNames={dashboard.chartStrategyNames} />
      <DashboardMetrics dashboardType={selectedDashboard} />
      <DashboardTransactionHistory dashboardType={selectedDashboard} />
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
