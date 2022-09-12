import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'


export const BIG_INT_1E18 = BigInt.fromString('1000000000000000000');
export const BIG_INT_1E7 = BigInt.fromString('10000000');
export const BIG_INT_0 = BigInt.fromI32(0);
export const BIG_INT_1 = BigInt.fromI32(1);

export const BIG_DECIMAL_1E18 = BigDecimal.fromString('1e18');
export const BIG_DECIMAL_1E7 = BigDecimal.fromString('1e7');
export const BIG_DECIMAL_0 = BigDecimal.fromString('0');
export const BIG_DECIMAL_MIN_1 = BigDecimal.fromString('-1');

export const OPS_MANAGER_ID = '0x65fe8babf7da367b2b45cbd748f0490713f84828';
export const TEMPLE_FRAX_PAIR = '0x6021444f1706f15465bee85463bcc7d7cc17fc03';

export const TEMPLE_ADDRESS = Address.fromString('0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7');
export const TEMPLE_LOCAL_ADDRESS = Address.fromString('0x5fbdb2315678afecb367f032d93f642f64180aa3');
export const TEMPLE_RINKEBY_ADDRESS = Address.fromString('0x359655dcb8a32479680af81eb38ea3bb2b42af54');
