export type Entry = {
  id: string | number;
  entryDate?: Date;
  amount?: number; // TODO: do we need a BigNumber type here?
  percent?: number;
  inZone?: boolean;
  type?: MarkerType;
  currentCycle?: number;
};

export type Vault = {
  id: string;
  months: number;
  now: Date;
  startDate: Date;
  entries: Entry[];
  currentCycle?: number;
  zoneEmpty?: boolean;
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
