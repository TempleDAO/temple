export type Entry = {
  id: string | number;
  entryDate: Date;
  amount: number; // TODO: do we need a BigNumber type here?
}

export type Vault = {
  id: string;
  months: number;
  now: Date;
  startDate: Date;
  entries: [Entry]
}

export type Point = {
  x: number;
  y: number;
};


export type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};