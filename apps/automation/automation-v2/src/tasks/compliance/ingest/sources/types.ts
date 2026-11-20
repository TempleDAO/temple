import type { TaskContext } from '@mountainpath9/overlord-core';

/**
 * Safety limits the ingest framework applies to every fetch of a Source.
 * A Publication that breaks one is Rejected: the Snapshot still stands.
 */
export interface SourceLimits {
  /** Fewer addresses than this means a truncated or broken download. */
  minCount: number;
  /** More removals than this in one Publication means a broken download. */
  maxDropPerPublication: number;
  /** Raise SourceUnconfirmed when no check has succeeded for this long. */
  unconfirmedAfterSecs: number;
}

/** One Publication as fetched, before the framework checks it. */
export interface SourceFetch {
  /**
   * Addresses as published. The framework validates, lower-cases and
   * dedupes them; a single invalid entry rejects the whole fetch.
   */
  addresses: readonly string[];
  /**
   * Entries the Source itself refused, described for humans, such as a
   * Manual source entry with no reason. Any of them rejects the whole
   * Publication, the same as an invalid address.
   */
  invalid?: readonly string[];
  /** The publisher's own version (OFAC publicationID), kept for audit and for `latestVersion()`. */
  version?: string;
}

/**
 * A publisher of addresses that must be flagged. It releases Publications;
 * the framework turns accepted ones into Snapshots.
 *
 * A Source only knows how to fetch and parse. The ingest framework owns
 * everything else: the Absent/Fresh/Failing/Rejected state machine, KV
 * persistence, the Limits, normalisation and Findings. Add a Source by
 * implementing this type and registering it in `SOURCES`.
 */
export type ComplianceSource = {
  /** Stable id: names the ingest task, the KV key and Finding keys. */
  readonly id: string;
  /** One line for humans, shown in Notices. */
  readonly description: string;
  readonly limits: SourceLimits;
  /** Fetches and parses the latest Publication. Throw on any transport or parse error. */
  fetch(ctx: TaskContext): Promise<SourceFetch>;
} & (
  | {
      /** It has a cheap `latestVersion()` check. */
      readonly versioned: true;
      /**
       * Cheap change check. Returns the version `fetch()` would return
       * now, without fetching the Publication. When it matches the Snapshot's
       * version, the framework skips `fetch()`. Sources without one are
       * fetched every run.
       */
      latestVersion(ctx: TaskContext): Promise<string>;
    }
  | { readonly versioned: false }
);
