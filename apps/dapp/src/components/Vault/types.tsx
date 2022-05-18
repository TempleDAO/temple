import { MutableRefObject, ReactNode } from 'react';

export type Marker = {
  vaultId: string;
  staked: number; // TODO: do we need a BigNumber type here?
  percent: number;
  inZone: boolean;
  type: MarkerType;
  unlockDate: Date | 'NOW';
  windowEndDate: Date;
  label: string;
};

export type Vault = {
  id: string;
  tvl: number;
  now: Date;
  // Start of vault instance
  startDate: Date;
  isActive: boolean;
  label: string;
  startDateSeconds: number;
  enterExitWindowDurationSeconds: number;
  periodDurationSeconds: number;
  amountStaked: number;
  unlockDate: Date | 'NOW';
};

export type VaultGroup = {
  id: string;
  name: string;
  months: number;
  vaults: Vault[];
  startDate: Date;
  tvl: number;
  enterExitWindowDurationSeconds: number;
  periodDurationSeconds: number;
  periods: number;
  cycleStart: Date; // Date of this cycle's start
  cycleEnd: Date;   // Date of current cycle's
};

export type VaultProps = {
  selectedNav: VaultPage;
  children: ReactNode;
};

export type Point = {
  x: number;
  y: number;
};

export enum MarkerType {
  EMPTY,
  STAKING_IN_ZONE,
  STAKING,
  HIDDEN,
}

export type VaultPage = 'claim' | 'stake' | 'summary' | 'strategy' | 'timing';

export type VaultRef = {
  svgRef: SVGSVGElement | null;
  popupRef: MutableRefObject<any> | null;
};
