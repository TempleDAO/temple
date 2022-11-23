import { BigInt } from '@graphprotocol/graph-ts'

import { MetricDayData, Metric } from '../../generated/schema'

import { BIG_DECIMAL_0, BIG_INT_0, OPS_MANAGER_ID } from '../utils/constants'
import { dayFromTimestamp } from '../utils/dates'


export function getMetric(): Metric {
  let metric = Metric.load(OPS_MANAGER_ID)

  if (metric === null) {
    metric = new Metric(OPS_MANAGER_ID)
    metric.volume = BIG_DECIMAL_0
    metric.volumeUSD = BIG_DECIMAL_0
    metric.tvl = BIG_DECIMAL_0
    metric.tvlUSD = BIG_DECIMAL_0
    metric.vaultCount = BIG_INT_0
    metric.exposureCount = BIG_INT_0
    metric.tfrCount = BIG_INT_0
    metric.tokenCount = BIG_INT_0
    metric.userCount = BIG_INT_0
    metric.vaultGroupCount = BIG_INT_0
    metric.vaults = []
  }

  return metric as Metric
}

export function updateMetric(metric: Metric, timestamp: BigInt): void {
  metric.timestamp = timestamp
  metric.save()

  updateOrCreateDayData(metric, timestamp)
}

export function updateOrCreateDayData(metric: Metric, timestamp: BigInt): void {
  const dayTimestamp = dayFromTimestamp(timestamp);

  let dayData = MetricDayData.load(dayTimestamp)
  if (dayData === null) {
    dayData = new MetricDayData(dayTimestamp)
  }

  dayData.metric = metric.id
  dayData.timestamp = timestamp
  dayData.volume = metric.volume
  dayData.volumeUSD = metric.volumeUSD
  dayData.tvl = metric.tvl
  dayData.tvlUSD = metric.tvlUSD
  dayData.vaultCount = metric.vaultCount
  dayData.exposureCount = metric.exposureCount
  dayData.tfrCount = metric.tfrCount
  dayData.tokenCount = metric.tokenCount
  dayData.userCount = metric.userCount
  dayData.vaultGroupCount = metric.vaultGroupCount
  dayData.vaults = metric.vaults
  dayData.save()
}
