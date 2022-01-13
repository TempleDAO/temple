const BRANCH = process.env.VERCEL_GIT_COMMIT_REF;

const VALID_BUILD_BRANCHES = ['main', 'develop', 'hotfix', 'staging', 'intra'];

if (VALID_BUILD_BRANCHES.find((validBranch) => validBranch === BRANCH)) {
  process.exit(0);
} else {
  process.exit(1);
}
