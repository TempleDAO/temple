/**
 * Ingest: one task per Source fetches it, validates the result and stores
 * a Snapshot. Flag reads the stored state through `readSourceState` and
 * `SourceState.snapshot`; it never touches a Source.
 */
export { ingestTask } from './task';
export { readSourceState } from './store';
export { SourceState } from './state';
export { SOURCES, type SourceId } from './sources';
