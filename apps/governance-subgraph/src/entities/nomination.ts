import { UpdateNomination } from '../../generated/ElderElection/ElderElection'
import { Nomination } from '../../generated/schema'

import { getMetric, updateMetric } from './metric'
import { getTemplar, updateTemplar } from './templar'


export function updateNomination(event: UpdateNomination): void {
  const timestamp = event.block.timestamp
  const metric = getMetric(timestamp)

  const discordId = event.params.discordId
  const templar = getTemplar(discordId)
  if (templar === null) {
    return
  }

  const nominationId = discordId.toString() + '-' + timestamp.toString()
  const nomination = new Nomination(nominationId)
  const isNominated = event.params.isNominated
  if (isNominated) {
    templar.isNominated = true
    metric.candidates += 1
  } else {
    templar.isNominated = false
    metric.candidates -= 1
  }

  updateMetric(metric, timestamp)
  updateTemplar(templar, timestamp)

  nomination.timestamp = timestamp
  nomination.templar = templar.id
  nomination.isNominated = templar.isNominated
  nomination.save()
}
