import { expect, test, vi } from 'vitest';
import {
  type Json,
  type TaskContext,
  taskSuccessSilent,
} from '@mountainpath9/overlord-core';
import { Finding, FindingSink } from './findings';
import { reportRun, RunReport, runWithFindings } from './run';

const absent: Finding = {
  kind: 'SourceAbsent',
  key: 'manual',
  summary: 'none',
};

test('a body that throws fails the task, and saves or posts nothing', async () => {
  const touched: string[] = [];
  const ctx = {
    kvGet: async (key: string) => {
      touched.push(`get ${key}`);
      return undefined;
    },
    kvSet: async (key: string) => {
      touched.push(`set ${key}`);
    },
  } as unknown as TaskContext;
  const thrown = new Error('replacement underpriced');

  await expect(
    runWithFindings(
      ctx,
      'flag:sepolia',
      async (_, text) => {
        touched.push(`post ${text}`);
        return true;
      },
      async (sink) => {
        sink.report(absent);
        throw thrown;
      }
    )
  ).rejects.toBe(thrown);
  expect(touched).toEqual([]);
});

test('reporting a run with a send failure posts its Notices, then fails the run', async () => {
  const failure = new Error('replacement underpriced');
  const sink = new FindingSink();
  const posted: string[] = [];
  await expect(
    reportRun(
      {
        findings: [absent],
        notices: ['batch 1'],
        sendFailure: failure,
      },
      sink,
      async (n) => {
        posted.push(n);
      }
    )
  ).rejects.toBe(failure);
  expect(posted).toEqual(['batch 1']);
  expect(sink.all().map((f) => f.key)).toEqual(['manual']);
});

test('a Notice that fails to post leaves the rest posted, then fails the run with every error', async () => {
  const failure = new Error('replacement underpriced');
  const discordDown = new Error('discord 503');
  const posted: string[] = [];
  const post = async (n: string) => {
    if (n === 'batch 1') throw discordDown;
    posted.push(n);
  };

  await expect(
    reportRun(
      { findings: [], notices: ['batch 1', 'batch 2'] },
      new FindingSink(),
      post
    )
  ).rejects.toBe(discordDown);
  expect(posted).toEqual(['batch 2']);

  posted.length = 0;
  const thrown = await reportRun(
    { findings: [], notices: ['batch 1', 'batch 2'], sendFailure: failure },
    new FindingSink(),
    post
  ).catch((e: unknown) => e);
  expect(posted).toEqual(['batch 2']);
  expect(thrown).toBeInstanceOf(AggregateError);
  expect((thrown as AggregateError).errors).toEqual([failure, discordDown]);
});

test("one owner's completed run never resolves another owner's Findings", async () => {
  const { ctx } = fakeContext();
  const posted = async () => true;
  const reporting = (finding?: Finding) => async (sink: FindingSink) => {
    if (finding) sink.report(finding);
    return taskSuccessSilent();
  };

  // A run that opens, resolves or reminds posts, and so succeeds loudly.
  expect(
    (await runWithFindings(ctx, 'flag:a', posted, reporting(absent))).kind
  ).toBe('success');
  expect((await runWithFindings(ctx, 'flag:b', posted, reporting())).kind).toBe(
    'successSilent'
  );
  expect(
    (await runWithFindings(ctx, 'flag:a', posted, reporting(absent))).kind
  ).toBe('successSilent');
});

test('a run that pauses a check posts no resolve for its open Findings, and reminds naming the pause', async () => {
  const { ctx } = fakeContext(); // reminders every 900 s
  const posted: string[] = [];
  const post = async (_: unknown, text: string) => {
    posted.push(text.split('\n')[0]);
    return true;
  };
  const unbacked: Finding = {
    kind: 'UnbackedFlag',
    key: '0xee',
    summary: 'Flagged but no Source lists it',
  };
  const flagRun =
    (run: Pick<RunReport<never>, 'findings' | 'paused'>) =>
    async (sink: FindingSink) => {
      await reportRun({ ...run, notices: [] }, sink, async () => {});
      return taskSuccessSilent();
    };
  const indexFailing = flagRun({
    findings: [],
    paused: [{ kind: 'UnbackedFlag', by: 'FlaggedAddressesIndexFailing' }],
  });

  vi.useFakeTimers({ now: 0 });
  try {
    await runWithFindings(
      ctx,
      'flag:a',
      post,
      flagRun({ findings: [unbacked] })
    );
    await runWithFindings(ctx, 'flag:a', post, indexFailing);
    vi.setSystemTime(900_000);
    await runWithFindings(ctx, 'flag:a', post, indexFailing);
    vi.setSystemTime(1_000_000);
    await runWithFindings(
      ctx,
      'flag:a',
      post,
      flagRun({ findings: [unbacked] })
    );
  } finally {
    vi.useRealTimers();
  }
  expect(posted).toEqual([
    '🔴 `flag:a` **UnbackedFlag** `0xee`: Flagged but no Source lists it',
    '🟠 still open (check paused by FlaggedAddressesIndexFailing): `flag:a` **UnbackedFlag** `0xee`: Flagged but no Source lists it',
  ]);
});

test('a Finding that cannot be posted is logged, fails the run and saves nothing', async () => {
  const { ctx, kv, logged } = fakeContext();
  const unset = async () => false;

  await expect(
    runWithFindings(ctx, 'flag:a', unset, async (sink) => {
      sink.report(absent);
      return taskSuccessSilent();
    })
  ).rejects.toThrow(
    'webhook_url is unset: compliance flag:a could not post: 🔴 `flag:a` **SourceAbsent** `manual`: none'
  );
  expect(kv.size).toBe(0);
  expect(logged).toEqual([
    expect.stringMatching(
      /^warn 🔴 `flag:a` \*\*SourceAbsent\*\* `manual`: none\n> /
    ),
  ]);
});

test('a stored Finding of an unknown kind is dropped with a warning, and the rest are kept', async () => {
  const { ctx, kv, logged } = fakeContext();
  const posted: string[] = [];
  const post = async (_: unknown, text: string) => {
    posted.push(text);
    return true;
  };
  const reporting = async (sink: FindingSink) => {
    sink.report(absent);
    return taskSuccessSilent();
  };
  await runWithFindings(ctx, 'flag:a', post, reporting);
  const [[key, saved]] = [...kv.entries()];
  kv.set(key, {
    ...(saved as Record<string, Json>),
    'NoLongerAKind:x': {
      kind: 'NoLongerAKind',
      key: 'x',
      summary: 'old',
      openedAtMs: 0,
      lastPostedAtMs: 0,
    },
  });
  posted.length = 0;
  logged.length = 0;

  const result = await runWithFindings(ctx, 'flag:a', post, reporting);

  expect(result.kind).toBe('successSilent');
  expect(posted).toEqual([]);
  expect(Object.keys(kv.get(key) as Record<string, Json>)).toEqual([
    Finding.id(absent),
  ]);
  expect(logged).toEqual([
    expect.stringMatching(
      /^warn compliance flag:a: dropped stored Finding NoLongerAKind:x: kind: /
    ),
  ]);
});

/** In-memory KV, logs captured, reminders every 900 s. */
function fakeContext() {
  const kv = new Map<string, Json>();
  const logged: string[] = [];
  const ctx = {
    kvGet: async (key: string) => kv.get(key),
    kvSet: async (key: string, value: Json) => {
      kv.set(key, value);
    },
    logger: {
      warn: (text: string) => logged.push(`warn ${text}`),
      info: (text: string) => logged.push(`info ${text}`),
    },
    config: {
      get: async () => undefined,
      getString: async () => undefined,
      getNumber: async (name: string) =>
        name === 'compliance_finding_reminder_secs' ? 900 : undefined,
    },
  } as unknown as TaskContext;
  return { ctx, kv, logged };
}
