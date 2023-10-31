export type Users = {
  id: string;
}[];

export interface SubGraphResponse<T extends object> {
  data?: T;
  errors?: { message: string }[];
}

export interface SubGraphQuery {
  query: string;
  variables?: { [key: string]: string | number };
}

export type GetUserResponse = SubGraphResponse<{ tlcUsers: Users }>;

export class SubgraphError extends Error {
  constructor(public message: string, public cause: Error) {
    super(message);
    this.name = 'SubgraphError';
    this.stack = cause.stack;
  }
}
