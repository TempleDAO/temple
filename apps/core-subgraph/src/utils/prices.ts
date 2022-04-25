import { BigDecimal } from '@graphprotocol/graph-ts';
import { EACAggregatorProxy as PriceOracle } from '../../generated/GaugeController/EACAggregatorProxy'

import { FXS_PRICE_FEED } from '../utils/constants';
import { toDecimal } from '../utils/decimals';

export function getFXSPriceInUSD(): BigDecimal {
    let oracle = PriceOracle.bind(FXS_PRICE_FEED)
    let price = toDecimal(oracle.latestAnswer(), 8)

    return price
}
