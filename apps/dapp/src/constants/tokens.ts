// https://docs.metamask.io/guide/rpc-api.html#unrestricted-methods
export interface Token {
  type: 'ERC20'; // In the future, other standards will be supported
  options: {
    address: string; // The address of the token contract
    'symbol': string; // A ticker symbol or shorthand, up to 5 characters
    decimals: number; // The number of token decimals
    image: string; // A string url of the token logo
  };
};

export const TEMPLE_TOKEN: Token = {
  type: 'ERC20',
  options: {
    address: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    symbol: 'TEMPLE',
    decimals: 18,
    image: 'https://etherscan.io/token/images/temple_32.png?v=3'
  },
};
