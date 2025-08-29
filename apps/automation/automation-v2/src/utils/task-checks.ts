import { KvPersistedValue } from "./kv";

export async function delayUntilNextCheckTime(
  checkPeriodMs: number,
  lastCheckTime: KvPersistedValue<Date>,
  now: Date
): Promise<boolean> {
    const t = await lastCheckTime.get();
    const checkNow = !t || now.getTime() > (t.getTime() + checkPeriodMs);
    if (checkNow) {
      await lastCheckTime.set(now);
    }
    return !checkNow;
}
