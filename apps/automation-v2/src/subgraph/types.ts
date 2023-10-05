export type Users = {
  id: string;
  collateral: string;
  collateralUSD: string;
  debt: string;
  debtUSD: string;
  enterTimestamp: string;
  exitTimestamp: string;
}[];

export interface SubGraphResponse<T extends object> {
  data?: T;
  errors?: { message: string }[];
}

export interface SubGraphQuery {
  query: string;
  variables?: { [key: string]: string | number };
}

export type GetUserResponse = SubGraphResponse<{ users: Users }>;

export class SubgraphError extends Error {
  constructor(public message: string, public cause: Error) {
    super(message);
    this.name = 'SubgraphError';
    this.stack = cause.stack;
  }
}
