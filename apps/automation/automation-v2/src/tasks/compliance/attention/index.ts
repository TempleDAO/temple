/**
 * Attention: everything that needs a human. Each task's run goes through
 * `runTask`, which reconciles the run's Findings with the open ones, posts
 * what opened, resolved or is due a reminder, and posts the run's Notices.
 */
export type { Finding } from './findings';
export { runTask } from './run';
