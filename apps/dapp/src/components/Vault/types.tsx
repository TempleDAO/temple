import { MutableRefObject, ReactNode } from 'react';

export type Entry = {
  id: string | number;
  entryDate?: Date;
  amount: string; // TODO: do we need a BigNumber type here?
  percent?: number;
  inZone?: boolean;
  type?: MarkerType;
  currentCycle?: number;
  value: string;
};

export type Vault = {
  id: string;
  // duration of vault in months (30 days)
  months: number;
  // tvl of vault instance
  tvl: number;
  now: Date;
  // Start of vault instance
  startDate: Date;
  entries: Entry[];


  // 0 index, how many times has the vault looped/cycled
  currentCycle: number;
  zoneEmpty?: boolean;
  // Is the vault in an enter/exit period.
  inZone: boolean;
  
  enterExitWindowDurationSeconds: number;
  periodDurationSeconds: number;
};

export type VaultGroup = {
  id: string;
  name: string;
  // duration of vault in months (30 days)
  months: number;
  // Underlying vault instances.
  vaults: Vault[];
  startDate: Date;
  tvl: number;
  enterExitWindowDurationSeconds: number;
  periodDurationSeconds: number;
}

export type VaultProps = {
  vaultGroup: VaultGroup;
  selectedNav: VaultPage;
  markerClick: (entryData: Entry, markerEl: SVGElement) => void;
  selectedEntry: Entry;
  markerPosition: Point;
  children: ReactNode;
};

export type Point = {
  x: number;
  y: number;
};

export enum MarkerType {
  EMPTY,
  STAKING,
  ZONE,
}

export type VaultPage = 'claim' | 'stake' | 'summary' | 'strategy' | 'timing';

export type VaultRef = {
  svgRef: SVGSVGElement | null;
  popupRef: MutableRefObject<any> | null;
};
