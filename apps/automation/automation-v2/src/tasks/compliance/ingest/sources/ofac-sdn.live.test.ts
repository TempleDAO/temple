import { expect, test } from 'vitest';
import { checkFetch } from '../state';
import { ofacSdnSource } from './ofac-sdn';

// Downloads the real SDN.XML (about 30 MB). Opt in with COMPLIANCE_LIVE=1.
test.skipIf(!process.env.COMPLIANCE_LIVE)(
  'fetches the current Publication within the Source limits',
  async () => {
    const publication = await ofacSdnSource.fetch(undefined as never);
    expect(publication.version).toMatch(/^\d+$/);
    expect(
      checkFetch(
        publication.addresses,
        undefined,
        ofacSdnSource.limits,
        publication.invalid
      )
    ).toMatchObject({ ok: true });
  },
  300_000
);
