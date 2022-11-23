import { BigInt, store } from '@graphprotocol/graph-ts'

import { UpdateEndorsements } from '../../generated/ElderElection/ElderElection'
import { Endorsement, Voter } from '../../generated/schema'
import { createVoter, getVoter, updateVoter } from './voter'

import { getMetric, updateMetric } from './metric'
import { getTemplar } from './templar'


export function updateEndorsements(event: UpdateEndorsements): void {
  const timestamp = event.block.timestamp
  const metric = getMetric(timestamp)

  const address = event.params.account.toHexString()
  let voter = getVoter(address)
  if (voter) {
    metric.endorsements -= voter.validEndorsements
    removeEndorsements(voter, timestamp)
  } else {
    voter = createVoter(address, timestamp)
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
        const endorsed = voter.endorsedCandidates
        endorsed.push(templar.id)
        voter.endorsedCandidates = endorsed
    }
  }

  metric.endorsements += validEndorsements
  updateMetric(metric, timestamp)

  voter.validEndorsements = validEndorsements
  updateVoter(voter, timestamp)
}

export function removeEndorsements(voter: Voter, timestamp: BigInt): void {
  for (let i = 0; i < voter.validEndorsements; i++) {
    store.remove('Endorsement', voter.id + '-' + i.toString())
  }

  voter.validEndorsements = 0
  voter.endorsedCandidates = []
  updateVoter(voter, timestamp)
}
