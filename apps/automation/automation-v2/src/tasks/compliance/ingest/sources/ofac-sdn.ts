import { z } from 'zod';
import type { ComplianceSource, SourceFetch } from './types';

/**
 * EVM addresses on OFAC's SDN list. A new publication is rare (a few a
 * month), and most don't touch crypto addresses, so `latestVersion()` keeps
 * the ~30 MB SDN.XML download to one per publication.
 *
 * SDN.XML is the legacy format, read in preference to SDN_ADVANCED.XML.
 * OFAC's FAQ on the advanced standard says "All OFAC XML files will contain
 * the same core sanctions list data": the advanced file only adds metadata
 * (name parts, whether an ID is genuine), and the legacy SDN.XML "will
 * remain in production". SDN.XML is about 30 MB, the advanced file about
 * 129 MB.
 * https://ofac.treasury.gov/sdn-list-data-formats-data-schemas/frequently-asked-questions-on-advanced-sanctions-list-standard
 *
 * Read from the Sanctions List Service, downloading the whole SDN.XML once
 * per new publicationID. OFAC also publishes a delta per Publication
 * (`/changes/<publicationID>`), but it is a field-level diff of entities (`add`, `remove`, `update` with
 * `oldValue`, keyed by internal ids). Applying it means keeping OFAC's
 * entity model in KV, and one missed or misapplied delta would drift the
 * Snapshot silently. A full download keeps every Publication self-checking
 * against `Record_Count` and the Source's Limits.
 */
export const ofacSdnSource: ComplianceSource = {
  id: 'ofac-sdn',
  description: 'OFAC SDN list, EVM addresses',
  limits: {
    // About 120-150 EVM addresses in 2026.
    minCount: 100,
    maxDropPerPublication: 10,
    unconfirmedAfterSecs: 6 * 60 * 60,
  },
  versioned: true,
  latestVersion: () => latestPublicationId(),
  async fetch() {
    // Read before the download. If a Publication lands in between, the
    // Snapshot carries the newer Publication under the older id, and the
    // next run fetches again because the id changed: one extra download,
    // no gap.
    const version = await latestPublicationId();
    const res = await fetch(
      `${SANCTIONS_LIST_SERVICE_URL}/api/PublicationPreview/exports/SDN.XML`,
      {
        headers: HEADERS,
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      }
    );
    if (!res.ok) throw new Error(`OFAC SDN.XML: HTTP ${res.status}`);
    return { ...parseSdnXml(await res.text()), version };
  },
};

/**
 * Latest SDN publicationID. Compares IDs, not dates: the dates carry no
 * time zone. Early January the current year's history is empty, so fall
 * back to the previous year.
 */
async function latestPublicationId(): Promise<string> {
  const year = new Date().getUTCFullYear();
  for (const y of [year, year - 1]) {
    const res = await fetch(
      `${SANCTIONS_LIST_SERVICE_URL}/changes/history/${y}`,
      { headers: HEADERS }
    );
    if (!res.ok) throw new Error(`OFAC history ${y}: HTTP ${res.status}`);
    const entries = historySchema.parse(await res.json());
    if (entries.length)
      return String(Math.max(...entries.map((e) => e.publicationID)));
  }
  throw new Error(`OFAC history is empty for ${year} and ${year - 1}`);
}

/**
 * The EVM addresses in an SDN.XML Publication. Each is an `<id>` whose
 * `idType` is "Digital Currency Address - <ticker>". EVM chains share one
 * address format under several tickers (ETH, USDT, USDC, ARB, BSC...), so
 * the value's shape decides, not the ticker. A `0x` value of 64 hex digits
 * is a non-EVM address (Sui, Aptos) and is skipped. Any other value that
 * starts with `0x` but isn't a 40-hex address is returned as `invalid`,
 * which rejects the Publication: better a stale Snapshot than a silently
 * dropped address.
 *
 * Throws unless the file holds exactly as many `sdnEntry` elements as its
 * `Record_Count` says and the file ends with `</sdnList>`, which catches a
 * truncated download.
 *
 * Regexes, not an XML parser: the input is one machine-generated file from
 * OFAC, `Record_Count` and the closing tag catch truncation, and a
 * malformed `0x` value rejects the Publication. It would miss CDATA, XML
 * entities or namespace prefixes inside `<id>`, none of which the file uses
 * today.
 */
export function parseSdnXml(xml: string): SourceFetch {
  const recordCount = /<Record_Count>\s*(\d+)\s*<\/Record_Count>/.exec(xml);
  if (!recordCount) throw new Error('SDN.XML: no Record_Count');
  const sdnEntryCount = xml.match(/<sdnEntry>/g)?.length ?? 0;
  if (sdnEntryCount !== Number(recordCount[1]))
    throw new Error(
      `SDN.XML: ${sdnEntryCount} sdnEntry elements, Record_Count ${recordCount[1]}`
    );
  if (!xml.trimEnd().endsWith('</sdnList>'))
    throw new Error('SDN.XML: does not end with </sdnList>');

  const addresses: string[] = [];
  const invalid: string[] = [];
  for (const [, id] of xml.matchAll(/<id>([\s\S]*?)<\/id>/g)) {
    const type = /<idType>([^<]*)<\/idType>/.exec(id)?.[1].trim();
    if (!type?.startsWith(DIGITAL_CURRENCY)) continue;
    const value = /<idNumber>([^<]*)<\/idNumber>/.exec(id)?.[1].trim() ?? '';
    if (EVM_ADDRESS.test(value)) addresses.push(value);
    else if (/^0x/i.test(value) && !NON_EVM_ADDRESS.test(value))
      invalid.push(`${type}: ${value} is not a 40-hex address`);
  }
  return { addresses, invalid };
}

const SANCTIONS_LIST_SERVICE_URL =
  'https://sanctionslistservice.ofac.treas.gov';
// The service may answer 403 without a User-Agent. Keep it generic.
const HEADERS = { 'User-Agent': 'temple-automation/compliance' };
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

const historySchema = z.array(z.object({ publicationID: z.number().int() }));

const DIGITAL_CURRENCY = 'Digital Currency Address - ';
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const NON_EVM_ADDRESS = /^0x[0-9a-fA-F]{64}$/;
