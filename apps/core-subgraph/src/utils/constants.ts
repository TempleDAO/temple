import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'


export const BIG_INT_1E18 = BigInt.fromString('1000000000000000000');
export const BIG_INT_1E7 = BigInt.fromString('10000000');
export const BIG_INT_0 = BigInt.fromI32(0);
export const BIG_INT_1 = BigInt.fromI32(1);

export const BIG_DECIMAL_1E18 = BigDecimal.fromString('1e18');
export const BIG_DECIMAL_1E7 = BigDecimal.fromString('1e7');
export const BIG_DECIMAL_0 = BigDecimal.fromString('0');

export const OPS_MANAGER = '0xf7d5a97b122dd7d5366045de76d4791ac5428da5';
export const OPS_MANAGER_LOCAL = '0x2e2ed0cfd3ad2f1d34481277b3204d807ca2f8c2';
export const OPS_MANAGER_RINKEBY = '0xf7d5a97b122dd7d5366045de76d4791ac5428da5';
export const TEMPLE_FRAX_PAIR = '0x6021444f1706f15465bee85463bcc7d7cc17fc03';

export const TEMPLE_LOCAL_ADDRESS = Address.fromString('0x5fbdb2315678afecb367f032d93f642f64180aa3');
export const TEMPLE_RINKEBY_ADDRESS = Address.fromString('0x359655dcb8a32479680af81eb38ea3bb2b42af54');
