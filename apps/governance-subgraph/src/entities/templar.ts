import { BigInt } from '@graphprotocol/graph-ts'

import { Transfer } from '../../generated/Templar/Templar'
import { Templar, TemplarData } from '../../generated/schema'

import { getMetric, updateMetric } from './metric'


export function createTemplar(event: Transfer): Templar {
  const timestamp = event.block.timestamp
  const metric = getMetric(timestamp)
  metric.templars += 1
  updateMetric(metric, timestamp)

  const discordId = event.params.tokenId.toString()
  const templar = new Templar(discordId)
  templar.timestamp = timestamp
  templar.address = event.params.to.toHexString()
  templar.uri = metric.templarBaseUri + discordId
  templar.isNominated = false
  templar.save()

  updateOrCreateData(templar, timestamp)

  return templar as Templar
}

export function getTemplar(discordId: BigInt): Templar | null {
  const templar = Templar.load(discordId.toString())

  return templar
}

export function updateTemplar(templar: Templar, timestamp: BigInt): void {
  templar.timestamp = timestamp
  templar.save()

  updateOrCreateData(templar, timestamp)
}

export function updateOrCreateData(templar: Templar, timestamp: BigInt): void {
  const templarDataId = templar.id + '-' + timestamp.toString()

  let templarData = TemplarData.load(templarDataId)
  if (templarData === null) {
    templarData = new TemplarData(templarDataId)
  }

  templarData.templar = templar.id
  templarData.timestamp = timestamp
  templarData.address = templar.address
  templarData.uri = templar.uri
  templarData.role = templar.role
  templarData.isNominated = templar.isNominated
  templarData.save()
}
