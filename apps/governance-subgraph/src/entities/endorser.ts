import { BigInt } from '@graphprotocol/graph-ts'

import { Endorser, EndorserData } from '../../generated/schema'


export function createEndorser(address: string, timestamp: BigInt): Endorser {
  const endorser = new Endorser(address)
  endorser.timestamp = timestamp
  endorser.validEndorsments = 0
  endorser.endorsedCandidates = []
  endorser.save()

  updateOrCreateData(endorser, timestamp)

  return endorser
}

export function getEndorser(endorserId: string): Endorser | null {
  const endorser = Endorser.load(endorserId)

  return endorser
}

export function updateEndorser(endorser: Endorser, timestamp: BigInt): void {
  endorser.timestamp = timestamp
  endorser.save()

  updateOrCreateData(endorser, timestamp)
}

export function updateOrCreateData(endorser: Endorser, timestamp: BigInt): void {
  const endorserDataId = endorser.id + '-' + timestamp.toString()

  let endorserData = EndorserData.load(endorserDataId)
  if (endorserData === null) {
    endorserData = new EndorserData(endorserDataId)
  }

  endorserData.endorser = endorser.id
  endorserData.timestamp = timestamp
  endorserData.validEndorsments = endorser.validEndorsments
  endorserData.endorsedCandidates = endorser.endorsedCandidates
  endorserData.save()
}
