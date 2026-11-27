import { manualSource } from './manual';
import { ofacSdnSource } from './ofac-sdn';
import type { ComplianceSource } from './types';

export type SourceId = keyof typeof SOURCES;

export type { ComplianceSource, SourceFetch, SourceLimits } from './types';

/**
 * Every Source, keyed by its `id`. A Deployment opts in by listing the id
 * in its `sourceIds`.
 */
export const SOURCES = {
  'ofac-sdn': ofacSdnSource,
  manual: manualSource,
} as const satisfies Record<string, ComplianceSource>;
