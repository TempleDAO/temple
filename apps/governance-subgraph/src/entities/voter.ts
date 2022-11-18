import { BigInt } from '@graphprotocol/graph-ts'

import { Voter, VoterData } from '../../generated/schema'


export function createVoter(address: string, timestamp: BigInt): Voter {
  const voter = new Voter(address)
  voter.timestamp = timestamp
  voter.validEndorsements = 0
  voter.endorsedCandidates = []
  voter.save()

  updateOrCreateData(voter, timestamp)

  return voter
}

export function getVoter(voterId: string): Voter | null {
  const voter = Voter.load(voterId)

  return voter
}

export function updateVoter(voter: Voter, timestamp: BigInt): void {
  voter.timestamp = timestamp
  voter.save()

  updateOrCreateData(voter, timestamp)
}

export function updateOrCreateData(voter: Voter, timestamp: BigInt): void {
  const voterDataId = voter.id + '-' + timestamp.toString()

  let voterData = VoterData.load(voterDataId)
  if (voterData === null) {
    voterData = new VoterData(voterDataId)
  }

  voterData.voter = voter.id
  voterData.timestamp = timestamp
  voterData.validEndorsements = voter.validEndorsements
  voterData.endorsedCandidates = voter.endorsedCandidates
  voterData.save()
}
