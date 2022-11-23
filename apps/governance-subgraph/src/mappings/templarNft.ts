import { Transfer, BaseUriUpdated } from '../../generated/Templar/Templar'

import { createTemplar, getTemplar, updateTemplar } from '../entities/templar'
import { getMetric, updateMetric } from '../entities/metric'
import { ADDRESS_ZERO } from '../utils/constants'


export function onTransfer(event: Transfer): void {
    if (event.params.from == ADDRESS_ZERO) {
        createTemplar(event)
    } else {
        const templar = getTemplar(event.params.tokenId)
        if (templar) {
            templar.address = event.params.to.toHexString()
            updateTemplar(templar, event.block.timestamp)
        }
    }
}

export function onBaseUriUpdated(event: BaseUriUpdated): void {
    const metric = getMetric(event.block.timestamp)
    metric.templarBaseUri = event.params.baseUri
    updateMetric(metric, event.block.timestamp)
}
