import env from 'constants/env';

/*
 Note that the StrategyKey matches what's in the contracts
 https://github.com/TempleDAO/temple/blob/stage/protocol/contracts/interfaces/v2/strategies/ITempleStrategy.sol#L57
*/
export enum StrategyKey {
  RAMOS = 'RamosStrategy',
  TLC = 'TlcStrategy',
  TEMPLEBASE = 'TempleBaseStrategy',
  SKY_FARM_BASE = 'DaiSkyFarmBaseStrategy',
  TEMPLO_MAYOR_GNOSIS = 'TemploMayorStrategy',
  FOHMO_GNOSIS = 'FohmoStrategy',
}

// Except this special case for the Treasury Reserves Vault dashboard
export const TRV_KEY = 'TreasuryReservesVault';
export type TrvKey = typeof TRV_KEY;

export const ALL_STRATEGIES = Object.values(StrategyKey);

export const isTRVDashboard = (strategy: StrategyKey | TrvKey) =>
  strategy === TRV_KEY;

export type DashboardData = {
  key: StrategyKey | TrvKey;
  name: string;
  title: string;
  path: string;
  description: string;
  contractLink: string;
};

export const Dashboards: DashboardData[] = [
  {
    key: TRV_KEY,
    name: 'Treasury Reserves Vault',
    title: 'TRV',
    path: 'treasuryreservesvault',
    description:
      'Treasury Reserves Vault (TRV) is the central clearinghouse for the Temple Treasury and critical coordinator for current Treasury Strategy allocations. When funding and management parameters are approved for a Strategy, the TRV will transfer funds and issue corresponding debt to the Strategy borrower. The current equity of the Strategy is discounted by the loan principal and accrued interest benchmarked to the prevailing rate of the current Base Strategy for the borrowed token.',
    contractLink: `${env.etherscan}/address/${env.contracts.treasuryReservesVault}`,
  },
  {
    key: StrategyKey.RAMOS,
    name: 'Ramos',
    title: 'RAMOS',
    path: 'ramos',
    description:
      'Ramos is the automated market operations (AMO) manager that supplies liquidity to the TEMPLE/DAI pool on the Balancer DEX. A bot manages the contract to support TEMPLE trading, reduce price volatility, and earn farming rewards.',
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.ramosStrategy}`,
  },
  {
    key: StrategyKey.TLC,
    name: 'TLC',
    title: 'TLC',
    path: 'tlc',
    description:
      'Temple Loving Care (also known as Temple Line of Credit) offers DAI lending for users who supply TEMPLE as collateral. The TLC will use the current Treasury Price Index (TPI) Oracle to determine the collateral value of TEMPLE. Users may borrow up to 85% loan-to-value (LTV) with the TEMPLE liquidation LTV set to 90%. There are no origination fees and users can withdraw their TEMPLE at any time by repaying the DAI loan. The TLC interest rate is set to a fixed rate that will be periodically updated to 2X the yield from the current Treasury Base Strategy e.g. sDAI. <a target="_blank" href="https://templedao.medium.com/he-who-controls-the-spice-controls-the-universe-bae5fb92bd43">Click here</a> to learn more about Temple Loving Care.',
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.tlcStrategy}`,
  },
  {
    key: StrategyKey.TEMPLEBASE,
    name: 'Temple Base',
    title: 'TEMPLE BASE',
    path: 'templebase',
    description:
      'TEMPLE Base strategy is the funding source for TEMPLE tokens for automated market operations (AMO) in the Treasury framework. The TRV facilitates the withdrawal of newly minted TEMPLE tokens from and the issuance of TEMPLE debt to the TEMPLE Base strategy. These TEMPLE tokens will be borrowed by a Treasury Strategy such as Ramos to generate returns. Once these tokens are repaid to the TRV, they will be deposited to the TEMPLE Base strategy to be burned. Positive returns will be realized when TEMPLE flows to the TEMPLE Base strategy is net positive.',
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.templeStrategy}`,
  },
  {
    key: StrategyKey.SKY_FARM_BASE,
    name: 'Sky Farm Base',
    title: 'SKY FARM BASE',
    path: 'skyfarmbase',
    description:
      'Idle reserve capital in the TRV that is not currently borrowed by a Strategy Borrower will be automatically directed to a Base Strategy to earn yield. The TRV Base Strategy is currently set to the Sky Farm Base Strategy. The current rate of return for the Base Strategy also serves as the performance benchmark or "risk-free" interest rate for Treasury Strategies.',
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.daiSkyFarmBaseStrategy}`,
  },
  {
    key: StrategyKey.TEMPLO_MAYOR_GNOSIS,
    name: 'Templo Mayor',
    title: 'TEMPLO MAYOR',
    path: 'templomayor',
    description:
      'Templo Mayor is an Gnosis Safe Omnibus Strategy that is particularly useful when full automation is not feasible. An Omnibus Strategy utilises the same bookkeeping structure and approval process as the automated Temple v2 Strategies, but may entail several related holdings or sub-positions that are managed holistically. For instance, deposits into different but similar or co-dependent vaults on the same platform or different platforms may be consolidated into one Omnibus Gnosis Safe. Partner seed allocations of a target risk profile may also be consolidated into an Omnibus Strategy to derisk any particular project. An Omnibus Strategy may provide additional operational efficiency and allow Stakeholders to evaluate a series of related deployments as one composite position rather than as singletons.',
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.temploMayorGnosisStrategy}`,
  },
  {
    key: StrategyKey.FOHMO_GNOSIS,
    name: 'Fohmo',
    title: 'FOHMO',
    path: 'fohmo',
    description:
      'FOHMO is a strategy that aims to maintain a maximally looped position in OHM',
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.fohmoGnosisStrategy}`,
  },
];
