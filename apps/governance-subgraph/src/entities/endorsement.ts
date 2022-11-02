import { BigInt, store } from '@graphprotocol/graph-ts'

import { UpdateEndorsements } from '../../generated/ElderElection/ElderElection'
import { Endorsement, Endorser } from '../../generated/schema'
import { createEndorser, getEndorser, updateEndorser } from './endorser'

import { getMetric, updateMetric } from './metric'
import { getTemplar } from './templar'


export function updateEndorsements(event: UpdateEndorsements): void {
  const timestamp = event.block.timestamp
  const metric = getMetric(timestamp)

  const address = event.params.account.toHexString()
  let endorser = getEndorser(address)
  if (endorser) {
    metric.endorsments -= endorser.validEndorsments
    removeEndorsments(endorser, timestamp)
  } else {
    endorser = createEndorser(address, timestamp)
  }

  const discordIds = event.params.discordIds
  let validEndorsments = 0
  for (let i = 0; i <= discordIds.length; i++) {
      const templar = getTemplar(discordIds[i])
      if (templar && templar.isNominated) {
        const endorsmentId = address + '-' + validEndorsments.toString()
        const endorsment = new Endorsement(endorsmentId)
        endorsment.timestamp = timestamp
        endorsment.address = address
        endorsment.templar = templar.id
        endorsment.save()

        validEndorsments += 1
        endorser.endorsedCandidates.push(templar.id)
    }
  }

  metric.endorsments += validEndorsments
  updateMetric(metric, timestamp)

  endorser.validEndorsments = validEndorsments
  updateEndorser(endorser, timestamp)
}

export function removeEndorsments(endorser: Endorser, timestamp: BigInt): void {
  for (let i = 0; i <= endorser.validEndorsments; i++) {
    store.remove('Endorsment', endorser.id + '-' + i.toString())
  }

  endorser.validEndorsments = 0
  endorser.endorsedCandidates = []
  updateEndorser(endorser, timestamp)
}
