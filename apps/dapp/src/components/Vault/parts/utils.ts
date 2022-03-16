import { getUnixTime, differenceInSeconds } from "date-fns";

export const SECONDS_IN_MONTH = 2_592_000; //30*24*60*60

export const processData = (originalData) => {
  const data = { ...originalData }; // shallow copy

  // TODO: for testing only, change to realtime date.
  data.now = new Date(data.now);
  data.startDate = new Date(data.startDate);
  data.currentCycle = getCurrentCycle(data.startDate, data.months, data.now);

  data.entries = data.entries.map((e) => {
    const entry = { ...e }; // shallow copy
    entry.entryDate = new Date(entry.entryDate);
    entry.percent = calculatePercent(entry, data);
    entry.inZone = calculateInZone(entry, data);
    entry.type = calculateEntryType(entry, data);
    return entry;
  });

  maybeInsertEmptyMarker(data);

  return data;
};

// If there is no other marker currently in the zone
// (because it cycled), then we should show the empty "Enter" marker
const maybeInsertEmptyMarker = (vault) => {
  let zoneEmpty = true;
  for (const entry of vault.entries) {
    if (entry.inZone) zoneEmpty = false;
    continue;
  }
  vault.zoneEmpty = zoneEmpty;
  if (zoneEmpty) {
    const emptyEntry = {
      id: "empty",
      inZone: true,
      type: "EMPTY",
    };
    emptyEntry.percent = calculateEmptyPercent(vault);
    vault.entries.push(emptyEntry);
  }
};

// we treat the zone the same as a "percent", so the calculations for it are the same
// and we use the percent value as a comparison to determine if we're in or out of the zone
const calculateInZone = (entry, vault) => {
  const zonePercent = 1 / vault.months;
  return entry.percent < zonePercent;
};

// returns enum of EMPTY | STAKING | ZONE
const calculateEntryType = (entry, vault) => {
  return entry.inZone ? "ZONE" : "STAKING";
};

// Calculate percet based on now to marker end of cycle
const calculatePercent = (entry, vault) => {
  const now = vault.now;
  const entryStartDate = entry.entryDate;
  const diff = differenceInSeconds(now, entryStartDate);
  if (diff < 0)
    console.error(
      "Data Error: Current date is less than entry date",
      entry,
      vault
    );
  const totalSecondsThisCycle = SECONDS_IN_MONTH * vault.months;
  const secondsIntoThisCycle = diff % totalSecondsThisCycle;
  const percent = secondsIntoThisCycle / totalSecondsThisCycle;
  return percent;
};

// Calculate percet based on now to marker end of cycle
const calculateEmptyPercent = (vault) => {
  const secondsSinceVaultStart = differenceInSeconds(
    vault.now,
    vault.startDate
  );
  if (secondsSinceVaultStart < 0)
    console.error(
      "Data Error: Current date is less than entry date",
      entry,
      vault
    );
  const totalSecondsThisCycle = SECONDS_IN_MONTH * vault.months;
  const secondsIntoThisCycle = secondsSinceVaultStart % totalSecondsThisCycle;
  const secondsIntoZone = secondsIntoThisCycle % SECONDS_IN_MONTH;
  const percent = secondsIntoZone / totalSecondsThisCycle;
  return percent;
};

// how many cycles since the vault started:
// months_since_start = seconds_since_vault_start / seconds_in_months
// cycles_since_start = floor(months_since_start / vault_months)
//     this could be something like
//     18mo... so we need to further mod this to get which X cycle
//     we're in. for ex, cycle 5 of a 6 mo vault
// current_cycle = cycles_since_start mod vault_months
const getCurrentCycle = (vaultStart, vaultMonths, now) => {
  const monthsSinceStart =
    differenceInSeconds(now, vaultStart) / SECONDS_IN_MONTH;
  const cyclesSinceStart = Math.floor(monthsSinceStart / vaultMonths);
  const currentCycle = cyclesSinceStart % vaultMonths;
  return currentCycle;
};

export const lerp = (v0, v1, t) => v0 * (1 - t) + v1 * t;
