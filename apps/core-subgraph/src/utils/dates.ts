import { BigInt } from '@graphprotocol/graph-ts'


export function dayFromTimestamp(timestamp: BigInt): string {
    const day_ts = timestamp.toI32() - (timestamp.toI32() % 86400)
    return day_ts.toString()
}

export function hourFromTimestamp(timestamp: BigInt): string {
    const hour_ts = timestamp.toI32() - (timestamp.toI32() % 3600)
    return hour_ts.toString()
}
