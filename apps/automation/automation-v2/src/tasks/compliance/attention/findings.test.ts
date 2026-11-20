import { expect, test } from 'vitest';
import { Finding, reconcileFindings } from './findings';

const unconfirmed: Finding = {
  kind: 'SourceUnconfirmed',
  key: 'ofac-sdn',
  summary: 'down',
};
const unbacked: Finding = {
  kind: 'UnbackedFlag',
  key: '0xaa',
  summary: 'flagged, in no source',
};

test('a completed run opens new findings and resolves missing ones', () => {
  const first = reconcileFindings({}, [unconfirmed], 0, 0);
  expect(first.opened.map(Finding.id)).toEqual(['SourceUnconfirmed:ofac-sdn']);

  const second = reconcileFindings(first.next, [unbacked], 1, 0);
  expect(second.opened.map(Finding.id)).toEqual(['UnbackedFlag:0xaa']);
  expect(second.resolved.map(Finding.id)).toEqual([
    'SourceUnconfirmed:ofac-sdn',
  ]);
});

test('a finding still open is not posted again until a reminder is due', () => {
  const { next } = reconcileFindings({}, [unconfirmed], 0, 60);
  const early = reconcileFindings(next, [unconfirmed], 59_000, 60);
  expect(early.opened.concat(early.reminded)).toEqual([]);
  const due = reconcileFindings(early.next, [unconfirmed], 60_000, 60);
  expect(due.reminded.map(Finding.id)).toEqual(['SourceUnconfirmed:ofac-sdn']);
  expect(due.next['SourceUnconfirmed:ofac-sdn'].openedAtMs).toBe(0);
});

test('with reminders at 0, an open finding is never posted again', () => {
  const { next } = reconcileFindings({}, [unconfirmed], 0, 0);
  const later = reconcileFindings(next, [unconfirmed], 365 * 86_400_000, 0);
  expect(later.opened.concat(later.reminded)).toEqual([]);
});

const missed: Finding = {
  kind: 'MissedExclusion',
  key: '0x01:0xaa',
  summary: 'filled while Flagged',
};

test('a MissedExclusion reminds daily while other kinds use the default', () => {
  const hourMs = 3_600_000;
  const { next } = reconcileFindings({}, [missed, unconfirmed], 0, 900);
  const hour = reconcileFindings(next, [missed, unconfirmed], hourMs, 900);
  expect(hour.reminded.map(Finding.id)).toEqual(['SourceUnconfirmed:ofac-sdn']);
  const day = reconcileFindings(next, [missed], 24 * hourMs, 900);
  expect(day.reminded.map(Finding.id)).toEqual(['MissedExclusion:0x01:0xaa']);
});
