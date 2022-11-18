import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'


export const BIG_INT_1E18 = BigInt.fromString('1000000000000000000')
export const BIG_INT_1E7 = BigInt.fromString('10000000')
export const BIG_INT_0 = BigInt.fromI32(0)
export const BIG_INT_1 = BigInt.fromI32(1)

export const BIG_DECIMAL_1E18 = BigDecimal.fromString('1e18')
export const BIG_DECIMAL_1E7 = BigDecimal.fromString('1e7')
export const BIG_DECIMAL_0 = BigDecimal.fromString('0')
export const BIG_DECIMAL_MIN_1 = BigDecimal.fromString('-1')

export const ADDRESS_ZERO = Address.fromString('0x0000000000000000000000000000000000000000')
export const OWNER = '0x84AF944A0C0b1a7A24D055c07dbbcE1659a73709'
