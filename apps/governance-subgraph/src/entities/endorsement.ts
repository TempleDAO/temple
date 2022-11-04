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
    metric.endorsements -= endorser.validEndorsements
    removeEndorsements(endorser, timestamp)
  } else {
    endorser = createEndorser(address, timestamp)
  }

  const discordIds = event.params.discordIds
  let validEndorsements = 0
  for (let i = 0; i < discordIds.length; i++) {
      const templar = getTemplar(discordIds[i])
      if (templar && templar.isNominated) {
        const endorsementId = address + '-' + validEndorsements.toString()
        const endorsement = new Endorsement(endorsementId)
        endorsement.timestamp = timestamp
        endorsement.address = address
        endorsement.templar = templar.id
        endorsement.save()

        validEndorsements += 1
        const endorsed = endorser.endorsedCandidates
        endorsed.push(templar.id)
        endorser.endorsedCandidates = endorsed
    }
  }

  metric.endorsements += validEndorsements
  updateMetric(metric, timestamp)

  endorser.validEndorsements = validEndorsements
  updateEndorser(endorser, timestamp)
}

export function removeEndorsements(endorser: Endorser, timestamp: BigInt): void {
  for (let i = 0; i < endorser.validEndorsements; i++) {
    store.remove('Endorsement', endorser.id + '-' + i.toString())
  }

  endorser.validEndorsements = 0
  endorser.endorsedCandidates = []
  updateEndorser(endorser, timestamp)
}
