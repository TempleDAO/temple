export type Callback = () => Promise<void> | (() => void);

export type MetaMaskError = Error & { data?: { message: string } };

export interface VaultFragment {
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

  // tvl
  // id
  // users(where: {id: "${walletAddress.toLowerCase()}"}) {
  //   vaultUserBalances(orderBy: timestamp where: { id: "${vaultAddress.toLowerCase()}${walletAddress.toLowerCase()}" }) {
  //     id
  //     timestamp
  //     value
  //     amount
  //   }
  //   id
  //   totalBalance
  //   depositsBalance
  //   deposits {
  //     amount
  //     id
  //     timestamp
  //     value
  //   }
  // }
  // firstPeriodStartTimestamp
  // timestamp
  // templeToken
  // symbol
  // shareBoostFactor
  // periodDuration
  // name
  // joiningFee
  // enterExitWindowDuration
}

export interface UserFragment {
  id: string;
  totalBalance: string;
  depositsBalance: string;
}