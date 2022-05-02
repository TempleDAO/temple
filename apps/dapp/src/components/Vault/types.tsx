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
  months: number;
  tvl: number;
  now: Date;
  startDate: Date;
  entries: Entry[];
  currentCycle?: number;
  zoneEmpty?: boolean;
  endDate: Date;
  inZone: boolean;
};

export type VaultGroup = {
  id: string;
  name: string;
  months: number;
  vaults: Vault[];
  startDate: Date;
  endDate: Date;
}

export type VaultProps = {
  vault: VaultGroup;
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
