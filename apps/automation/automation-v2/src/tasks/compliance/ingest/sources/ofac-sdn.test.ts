import { expect, test } from 'vitest';
import { parseSdnXml } from './ofac-sdn';

const ETH = '0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB';
const USDT = '0x252a8bd2319d8a555b872990601221b3a2053bce';

function id(type: string, value: string): string {
  return `<id><uid>1</uid><idType>${type}</idType><idNumber>${value}</idNumber></id>`;
}

/** An SDN.XML with one sdnEntry per `ids` group; Record_Count defaults to match. */
function sdnXml(ids: string[][], recordCount = ids.length): string {
  const entries = ids
    .map(
      (group) =>
        `<sdnEntry><uid>9</uid><idList>${group.join('')}</idList></sdnEntry>`
    )
    .join('\n');
  return `<?xml version="1.0" standalone="yes"?>
<sdnList xmlns="https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/XML">
  <publshInformation><Publish_Date>11/18/2026</Publish_Date><Record_Count>${recordCount}</Record_Count></publshInformation>
  ${entries}
</sdnList>`;
}

test('keeps EVM addresses under any Digital Currency ticker and skips other chains and id types', () => {
  const xml = sdnXml([
    [
      id('Digital Currency Address - ETH', ETH),
      id('Digital Currency Address - XBT', 'bc1qexampleexampleexample'),
      id('Passport', '0x1234'),
    ],
    [
      id('Digital Currency Address - USDT', ` ${USDT}\n`),
      id(
        'Digital Currency Address - TRX',
        'TJHZswisiMgjioAVpmpMSWXCeQGCPjcTMK'
      ),
    ],
  ]);
  expect(parseSdnXml(xml)).toEqual({ addresses: [ETH, USDT], invalid: [] });
});

test('a 0x value that is not a 40-hex address is invalid, not dropped', () => {
  const xml = sdnXml([
    [id('Digital Currency Address - ETH', '0x1CAb8177ACe78b1B6B1c3933')],
    [id('Digital Currency Address - ETH', ETH.slice(0, -1))],
  ]);
  expect(parseSdnXml(xml)).toEqual({
    addresses: [],
    invalid: [
      'Digital Currency Address - ETH: 0x1CAb8177ACe78b1B6B1c3933 is not a 40-hex address',
      `Digital Currency Address - ETH: ${ETH.slice(0, -1)} is not a 40-hex address`,
    ],
  });
});

test('a 0x value of 64 hex digits is a non-EVM address and is skipped', () => {
  const sui = `0x${'ab'.repeat(32)}`;
  const xml = sdnXml([
    [
      id('Digital Currency Address - SUI', sui),
      id('Digital Currency Address - ETH', ETH),
    ],
  ]);
  expect(parseSdnXml(xml)).toEqual({ addresses: [ETH], invalid: [] });
});

test('a truncated file throws: fewer sdnEntry elements than Record_Count', () => {
  const xml = sdnXml([[id('Digital Currency Address - ETH', ETH)]], 2);
  expect(() => parseSdnXml(xml)).toThrow('1 sdnEntry elements, Record_Count 2');
});

test('a file cut inside its last entry throws, even with every sdnEntry opened', () => {
  const xml = sdnXml([
    [id('Digital Currency Address - ETH', ETH)],
    [id('Digital Currency Address - USDT', USDT)],
  ]);
  const cut = xml.slice(0, xml.lastIndexOf('<idList>') + '<idList>'.length);
  expect(() => parseSdnXml(cut)).toThrow('does not end with </sdnList>');
});

test('a file without Record_Count throws', () => {
  expect(() => parseSdnXml('<sdnList></sdnList>')).toThrow('no Record_Count');
});
