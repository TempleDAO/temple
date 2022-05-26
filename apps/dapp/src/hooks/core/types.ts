export type Callback = () => Promise<void> | (() => void);

export type MetaMaskError = Error & { data?: { message: string } };

export interface GraphVaultGroup {
  id: string;
  vaults: GraphVault[];
}

export interface GraphVault {
  id: string;
  tvl: string;
  firstPeriodStartTimestamp: string;
  timestamp: string;
  templeToken: string;
  symbol: string;
  shareBoostFactor: string;
  periodDuration: string;
  name: string;
  joiningFee: string;
  enterExitWindowDuration: string;
  users: GraphUser[];
}

export interface GraphUser {
  id: string;
  totalBalance: string;
  depositsBalance: string;
  vaultUserBalances: GraphVaultUserBalance[];
  withdraws: GraphVaultTransaction[];
  deposits: GraphVaultTransaction[];
}

export interface GraphVaultUserBalance {
  id: string;
  timestamp: string;
  value: string;
  amount: string;
  staked: string;
}

export interface GraphVaultTransaction {
  id: string;
  timestamp: string;
  amount: string;
}

export interface SubGraphResponse<T extends object> {
  data?: T;
  errors?: { message: string }[];
};

export interface SubGraphQuery {
  query: string;
}

export type GetVaultGroupsResponse = SubGraphResponse<{ vaultGroups: GraphVaultGroup[] }>;
export type GetVaultGroupResponse = SubGraphResponse<{ vaultGroup: GraphVaultGroup }>;
