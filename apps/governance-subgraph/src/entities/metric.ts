import { BigInt } from '@graphprotocol/graph-ts'

import { MetricData, Metric } from '../../generated/schema'

import { OWNER } from '../utils/constants'


export function getMetric(timestamp: BigInt): Metric {
  let metric = Metric.load(OWNER)

  if (metric === null) {
    metric = new Metric(OWNER)
    metric.timestamp = timestamp
    metric.templars = 0
    metric.candidates = 0
    metric.endorsements = 0
    metric.templarBaseUri = 'https://discordapp.com/users/'
    metric.save()

    updateOrCreateData(metric, timestamp)
  }

  return metric as Metric
}

export function updateMetric(metric: Metric, timestamp: BigInt): void {
  metric.timestamp = timestamp
  metric.save()

  updateOrCreateData(metric, timestamp)
}

export function updateOrCreateData(metric: Metric, timestamp: BigInt): void {
  const metricDataId = metric.id + '-' + timestamp.toString()

  let metricData = MetricData.load(metricDataId)
  if (metricData === null) {
    metricData = new MetricData(metricDataId)
  }

  metricData.metric = metric.id
  metricData.timestamp = timestamp
  metricData.templars = metric.templars
  metricData.candidates = metric.candidates
  metricData.endorsements = metric.endorsements
  metricData.templarBaseUri = metric.templarBaseUri
  metricData.save()
}
