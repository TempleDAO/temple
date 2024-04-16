import { MutableRefObject, ReactNode } from 'react';
import { BigNumber } from 'ethers';

export type Marker = {
  vaultId: string;
  staked: number;
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
  currentCycle: number;
  // Start of vault instance
  startDate: Date;
  isActive: boolean;
  label: string;
  startDateSeconds: number;
  enterExitWindowDurationSeconds: number;
  periodDurationSeconds: number;
  amountStaked: BigNumber;
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
  cycleEnd: Date; // Date of current cycle's
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
  WITHDRAWABLE,
  LOCKED,
  HIDDEN,
}

export type VaultPage = 'claim' | 'stake' | 'summary' | 'strategy' | 'timing';

export type VaultRef = {
  svgRef: SVGSVGElement | null;
  popupRef: MutableRefObject<any> | null;
};
