import { Address, BigInt } from '@graphprotocol/graph-ts'

import { CreateExposure } from '../../generated/OpsManager/OpsManager'
import { Exposure } from '../../generated/schema'
import { Exposure as ExposureContract } from '../../generated/OpsManager/Exposure'

import { BIG_INT_1 } from '../utils/constants'
import { getMetric, updateMetric } from './metric'


export function createExposure(event: CreateExposure): Exposure {
  const metric = getMetric()
  metric.exposureCount = metric.exposureCount.plus(BIG_INT_1)
  updateMetric(metric, event.block.timestamp)

  const exposure = new Exposure(event.params.exposure.toHexString())
  exposure.timestamp = event.block.timestamp

  const exposureContract = ExposureContract.bind(event.params.exposure)
  const name = exposureContract.name()
  const symbol = exposureContract.symbol()
  const revalToken = exposureContract.revalToken().toHexString()
  const reval = exposureContract.reval()
  const liquidator = exposureContract.liquidator().toHexString()

  exposure.name = name
  exposure.symbol = symbol
  exposure.revalToken = revalToken
  exposure.reval = reval
  exposure.liquidator = liquidator
  exposure.save()

  return exposure as Exposure
}

export function getExposure(address: Address): Exposure {
  const exposure = Exposure.load(address.toHexString())

  return exposure as Exposure
}

export function updateExposure(address: Address, timestamp: BigInt): Exposure {
  const exposure = getExposure(address)

  exposure.timestamp = timestamp
  exposure.save()

  return exposure as Exposure
}
