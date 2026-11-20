import {
  TaskContext,
  TaskResult,
  taskSuccess,
  taskSuccessSilent,
} from '@mountainpath9/overlord-core';
import { z } from 'zod';
import { NotificationLevel, postDefconNotification } from '@/utils/discord';
import { compliance_finding_reminder_secs } from '../variables';
import {
  Finding,
  FINDING_KINDS,
  FindingKind,
  FindingOwner,
  FindingSink,
  NOTICE_LEVEL,
  OpenFinding,
  OpenFindings,
  reconcileFindings,
} from './findings';

/** What a run hands to attention. A send failure fails the task once its Notices are posted. */
export type RunReport<N> = {
  findings: readonly Finding[];
  notices: readonly N[];
  sendFailure?: unknown;
};

/** Posts one message at a level. False when `webhook_url` is unset. */
type Post = (level: NotificationLevel, text: string) => Promise<boolean>;

/**
 * One compliance task run: `run` inside runWithFindings, then its Findings
 * reported and each Notice posted at NOTICE_LEVEL as `noticeText`. The task
 * succeeds loudly only when it posted.
 */
export function runTask<N>(
  ctx: TaskContext,
  owner: FindingOwner,
  run: () => Promise<RunReport<N>>,
  noticeText: (notice: N) => string
): Promise<TaskResult> {
  const post: Post = (level, text) => postDefconNotification(level, text, ctx);
  return runWithFindings(ctx, owner, post, async (sink) => {
    const report = await run();
    await reportRun(report, sink, (n) =>
      announce(ctx, owner, post, NOTICE_LEVEL, 'info', noticeText(n))
    );
    return report.notices.length ? taskSuccess() : taskSuccessSilent();
  });
}

/**
 * Runs a task body with a FindingSink, then reconciles and posts what
 * changed. Every post is also logged, and one that can't be posted fails
 * the task before anything is saved. The body reports Findings and returns
 * its own result; it never posts a Finding's text itself.
 *
 * A body that throws fails the task as is: nothing is reconciled or saved,
 * so its open findings stay as they were, and Overlord's task exception
 * handler logs the error and posts it (`error_webhook_url`) on every
 * failing run.
 */
export async function runWithFindings(
  ctx: TaskContext,
  owner: FindingOwner,
  post: Post,
  body: (sink: FindingSink) => Promise<TaskResult>
): Promise<TaskResult> {
  const sink = new FindingSink();
  const result = await body(sink);

  const prev = await loadOpenFindings(ctx, owner);
  const { next, opened, reminded, resolved } = reconcileFindings(
    prev,
    sink.all(),
    Date.now(),
    await compliance_finding_reminder_secs.requireValue(ctx)
  );

  // Post before saving: if posting fails, the next run posts again.
  // A resolution goes to its kind's level, so it lands in the same thread.
  const posts = [
    ...opened.map((f) => ({
      f,
      log: 'warn' as const,
      text: `🔴 ${line(owner, f)}\n> ${FINDING_KINDS[f.kind].action}`,
    })),
    ...reminded.map((f) => ({
      f,
      log: 'warn' as const,
      text: `🟠 still open: ${line(owner, f)}`,
    })),
    ...resolved.map((f) => ({
      f,
      log: 'info' as const,
      text: `🟢 resolved: ${line(owner, f)}`,
    })),
  ];
  for (const { f, log, text } of posts)
    await announce(ctx, owner, post, FINDING_KINDS[f.kind].level, log, text);

  await ctx.kvSet(findingsKey(owner), next);
  return posts.length ? taskSuccess() : result;
}

/**
 * Hands a run on: reports its Findings to the sink, posts its Notices, then
 * throws its send failure if it has one, so the Notices of what was sent
 * are posted before the task fails.
 */
export async function reportRun<N>(
  run: RunReport<N>,
  sink: FindingSink,
  post: (notice: N) => Promise<unknown>
): Promise<void> {
  for (const f of run.findings) sink.report(f);
  for (const n of run.notices) await post(n);
  if ('sendFailure' in run) throw run.sendFailure;
}

/**
 * One KV key per owner. An owner's task never overlaps itself (Overlord
 * skips a run while the previous one is in progress), so no two writers
 * share a key and no update is lost.
 */
const findingsKey = (owner: FindingOwner) => `compliance/findings/${owner}`;

/** Parsed loosely first, so one bad entry doesn't fail the others. */
const storedSchema = z.record(z.unknown());

const openFindingSchema = z.object({
  kind: z.enum(Object.keys(FINDING_KINDS) as [FindingKind, ...FindingKind[]]),
  key: z.string(),
  summary: z.string(),
  openedAtMs: z.number(),
  lastPostedAtMs: z.number(),
});

/**
 * Keeps each stored Finding that still parses. One of a kind since renamed
 * or removed is dropped with a warning, not resolved: its kind has no level.
 */
async function loadOpenFindings(
  ctx: TaskContext,
  owner: FindingOwner
): Promise<OpenFindings> {
  const saved = await ctx.kvGet(findingsKey(owner));
  if (saved === undefined) return {};
  const open: OpenFindings = {};
  for (const [id, value] of Object.entries(storedSchema.parse(saved))) {
    const parsed = openFindingSchema.safeParse(value);
    if (parsed.success) open[id] = parsed.data;
    else
      ctx.logger.warn(
        `compliance ${owner}: dropped stored Finding ${id}: ${issues(parsed.error)}`
      );
  }
  return open;
}

const issues = (error: z.ZodError) =>
  error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');

const line = (owner: FindingOwner, f: OpenFinding) =>
  `\`${owner}\` **${f.kind}**${f.key ? ` \`${f.key}\`` : ''}: ${f.summary}`;

/** Logs `text`, then posts it; throws when it can't be posted. */
async function announce(
  ctx: TaskContext,
  owner: FindingOwner,
  post: Post,
  level: NotificationLevel,
  log: 'warn' | 'info',
  text: string
): Promise<void> {
  ctx.logger[log](text);
  if (!(await post(level, text)))
    throw new Error(
      `webhook_url is unset: compliance ${owner} could not post: ${text.split('\n')[0]}`
    );
}
