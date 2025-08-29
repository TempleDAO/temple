import { KvPersistedValue } from "./kv";

export async function getMsSinceLastDistribution(
    lastRebalanceTime: KvPersistedValue<Date>,
    now: Date
): Promise<number | undefined> {
    const t = await lastRebalanceTime.get();
    if (t) {
      return now.getTime() - t.getTime();
    }
    return undefined;
}