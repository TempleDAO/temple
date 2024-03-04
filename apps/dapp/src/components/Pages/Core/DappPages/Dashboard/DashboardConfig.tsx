import env from 'constants/env';

export enum StrategyKey {
  RAMOS = 'RamosStrategy',
  // TLC = 'TlcStrategy',
  TEMPLEBASE = 'TempleBaseStrategy',
  DSRBASE = 'DsrBaseStrategy',
  TEMPLO_MAYOR_GNOSIS = 'TemploMayorStrategy',
  FOHMO_GNOSIS = 'FohmoStrategy',
  ALL = 'All',
  // TODO: This probably could be consolidated with ALL
  TREASURY_RESERVES_VAULT = 'TreasuryReservesVault',
}

export type DashboardData = {
  key: StrategyKey;
  name: string;
  title: string;
  path: string;
  description: string;
  chartStrategyNames: string[];
  contractLink: string;
};

export const Dashboards: DashboardData[] = [
  {
    key: StrategyKey.TREASURY_RESERVES_VAULT,
    name: 'Treasury Reserves Vault',
    title: 'TRV',
    path: 'treasuryreservesvault',
    description:
      'Treasury Reserves Vault (TRV) coordinates and manages the flow of capital for current Treasury allocations. When funding and management parameters are approved for a Strategy, the TRV will transfer funds e.g. DAI and issue corresponding debt to the Strategy borrower. The current equity of the Strategy is discounted by the loan principal and accrued interest benchmarked to the prevailing rate of the current Base Strategy for the borrowed token.',
    chartStrategyNames: [
        StrategyKey.TEMPLEBASE,
        StrategyKey.RAMOS,
        StrategyKey.DSRBASE,
        StrategyKey.TEMPLO_MAYOR_GNOSIS,
        StrategyKey.FOHMO_GNOSIS,
    ],
    contractLink: `${env.etherscan}/address/${env.contracts.treasuryReservesVault}`,
  },
  {
    key: StrategyKey.RAMOS,
    name: 'Ramos',
    title: 'RAMOS',
    path: 'ramos',
    description:
      'Ramos is the automated market operations (AMO) manager that supplies liquidity to the TEMPLE/DAI pool on the Balancer Exchange platform. A bot manages the contract to support TEMPLE trading, reduce price volatility, and earn farming rewards.',
    chartStrategyNames: [
      StrategyKey.RAMOS
    ],
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.ramosStrategy}`,
  },
  //   { // TODO: Hidden until launch
  // key: DashboardKey.TLC,
  // name: 'TLC',
  // title: 'TLC',
  // path: 'tlc',
  // description:
  //   'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vehicula tincidunt eleifend. Nam congue magna in mi dignissim, id gravida sem ornare. Sed in nunc fermentum, consectetur ipsum a, varius augue. Nullam finibus velit eget ligula efficitur, in luctus lacus efficitur. Nam egestas tempor gravida. Ut mollis libero ac tincidunt fermentum. Etiam et ante vitae metus ultrices tempus.',
  // chartStrategyNames: [
  //   // StrategyKey.TLC
  // ],
  // contractLink: `${env.etherscan}/address/${env.contracts.strategies.tlcStrategy}`,
  //   },
  {
    key: StrategyKey.TEMPLEBASE,
    name: 'Temple Base',
    title: 'TEMPLE BASE',
    path: 'templebase',
    description:
      'Temple Base strategy is the source of automated market operations (AMO) TEMPLE tokens in the Treasury framework. The TRV facilitates the withdrawal of newly minted TEMPLE tokens from and the issuance of TEMPLE debt to the Temple Base strategy. These TEMPLE tokens will be borrowed by a Treasury Strategy such as Ramos to generate returns. Once these tokens are repaid to the TRV, they will be deposited to the Temple Base strategy to be burned. From the perspective of the TRV, positive returns will be realized when TEMPLE flows to the Temple Base strategy is net positive.',
    chartStrategyNames: [
      StrategyKey.TEMPLEBASE
    ],
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.templeStrategy}`,
  },
  {
    key: StrategyKey.DSRBASE,
    name: 'DSR Base',
    title: 'DSR BASE',
    path: 'dsrbase',
    description:
      'Idle capital in the Treasury Reserves Vault (TRV) that is not currently deployed to a Strategy borrower will be automatically directed to a Base Strategy to earn yield. Currently, the Base Strategy is set to the Dai Savings Rate (DSR) which makes DAI the base currency of the TRV. The current rate of return for DSR Base also serves as the benchmark interest rate for the Treasury Strategy that borrows DAI from the TRV.',
    chartStrategyNames: [
      StrategyKey.DSRBASE
    ],
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.dsrBaseStrategy}`,
  },
  {
    key: StrategyKey.TEMPLO_MAYOR_GNOSIS,
    name: 'Templo Mayor',
    title: 'TEMPLO MAYOR',
    path: 'templomayor',
    description:
      'Templo Mayor is an Gnosis Safe Omnibus strategy. An Omnibus Strategy utilises the same bookkeeping structure and approval process, but may entail several related holdings or sub-positions that are managed as a whole. For instance, deposits into different but similar or co-dependent vaults on the same platform or different platforms may be consolidated into one Omnibus Gnosis Safe. Seed allocations of a target risk profile may also be consolidated into an Omnibus Strategy to reduce the noise. Therefore an Omnibus Strategy may provide additional operational efficiency and allow Stakeholders to evaluate a series of related deployments as one composite position rather than as singletons.',
    chartStrategyNames: [
      StrategyKey.TEMPLO_MAYOR_GNOSIS
    ],
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.temploMayorGnosisStrategy}`,
  },
  {
    key: StrategyKey.FOHMO_GNOSIS,
    name: 'Fohmo',
    title: 'FOHMO',
    path: 'fohmo',
    description:
      'FOHMO is a Gnosis Safe that holds the governance tokens for the DSR ecosystem. It is the primary point of interaction for the governance of the DSR ecosystem.',
    chartStrategyNames: [
      StrategyKey.FOHMO_GNOSIS
    ],
    contractLink: `${env.etherscan}/address/${env.contracts.strategies.fohmoGnosisStrategy}`,
  },
];
