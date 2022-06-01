import { Address, BigDecimal } from '@graphprotocol/graph-ts'

import { TemplePair as TemplePairContract} from '../../generated/OpsManager/TemplePair'

import { BIG_DECIMAL_0, TEMPLE_FRAX_PAIR } from '../utils/constants'


export function getTemplePrice(): BigDecimal {
    const pair = TemplePairContract.bind(Address.fromString(TEMPLE_FRAX_PAIR))

    const reserves = pair.try_getReserves()
    if (reserves.reverted) {
        // Hardcoded to 0.69 for test deployments
        return BigDecimal.fromString('0.69')
    }

    const reserve0 = reserves.value.value0.toBigDecimal()
    const reserve1 = reserves.value.value1.toBigDecimal()

    if (reserve0.notEqual(BIG_DECIMAL_0) && reserve1.notEqual(BIG_DECIMAL_0)) {
        const templePrice = reserve1.div(reserve0)
        return templePrice
    } else {
        return BIG_DECIMAL_0
    }
}
