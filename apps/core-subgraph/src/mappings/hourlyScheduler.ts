import { AnswerUpdated } from '../../generated/HourlyScheduler/OffchainAggregator'

import { getMetric, updateMetric } from '../entities/metric'
import { getVaultGroups, updateVaultGroups } from '../entities/vaultGroup'


export function onAnswerUpdated(event: AnswerUpdated): void {
    // Update vaultGroups
    const vaultGroups = getVaultGroups()
    updateVaultGroups(vaultGroups, event.block.timestamp)

    // Update metrics
    const metric = getMetric()
    updateMetric(metric, event.block.timestamp)
}
