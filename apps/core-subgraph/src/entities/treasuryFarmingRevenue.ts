import { Address, BigInt } from '@graphprotocol/graph-ts'

import { CreateExposure } from '../../generated/OpsManager/OpsManager'
import { TreasuryFarmingRevenue } from '../../generated/schema'
import { TreasuryFarmingRevenue as TreasuryFarmingRevenueContract } from '../../generated/OpsManager/TreasuryFarmingRevenue'

import { BIG_INT_0, BIG_INT_1 } from '../utils/constants'
import { getExposure } from './exposure'
import { getMetric, updateMetric } from './metric'


export function createTreasuryFarmingRevenue(event: CreateExposure): TreasuryFarmingRevenue {
  const metric = getMetric()
  metric.tfrCount = metric.tfrCount.plus(BIG_INT_1)
  updateMetric(metric, event.block.timestamp)

  const tfr = new TreasuryFarmingRevenue(event.params.primaryRevenue.toHexString())
  tfr.timestamp = event.block.timestamp

  const tfrContract = TreasuryFarmingRevenueContract.bind(event.params.exposure)
  const totalShares = tfrContract.totalShares()
  let lifetimeAccRevenueScaledByShare = BIG_INT_0
  const lifetimeRevenue = tfrContract.try_lifetimeAccRevenueScaledByShare()
  if (!lifetimeRevenue.reverted) {
    lifetimeAccRevenueScaledByShare = lifetimeRevenue.value
  }
  tfr.totalShares = totalShares
  tfr.lifetimeAccRevenueScaledByShare = lifetimeAccRevenueScaledByShare

  const exposure = getExposure(event.params.exposure)
  tfr.exposure = exposure.id
  tfr.save()

  return tfr as TreasuryFarmingRevenue
}

export function getTreasuryFarmingRevenue(address: Address): TreasuryFarmingRevenue {
  const tfr = TreasuryFarmingRevenue.load(address.toHexString())

  return tfr as TreasuryFarmingRevenue
}

export function updatTreasuryFarmingRevenue(address: Address, timestamp: BigInt): TreasuryFarmingRevenue {
  const tfr = getTreasuryFarmingRevenue(address)

  tfr.timestamp = timestamp
  tfr.save()

  return tfr as TreasuryFarmingRevenue
}
