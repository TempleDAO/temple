## Git flow

The proposed workflow envisions facilitating an asynchronous workflow by multiple teams/contributors with an emphasis of making it easy to revert changes that go wrong. Some configurations in terms of permissions should be done on the repo in order to make the workflow as resilient as possible to human error.

### Branches
#### Long lived branches:
- **main**
- **release**
- **develop**
- **hotfix**
  
#### On demand branches:
- working branches (features, fixes, refactors, etc.)

Descriptions:

`main` - Stable branch. The `main` branch's purpose is to match the currently deployed code. 

- New commits should only be added to `main` from PRs coming from either `hotfix` or `release` (*exclusively* at the end of the cycle). Only maintainers of the dapp should have permission to merge/rebase into `main`. Only new `release` versions and hotfixes should be merged into this branch.

`release` - End of cycle branch. The `release` branch should be forked/rebased from `develop` after enough product increments have been successfully merged into `develop` to justify a new release. 

- Alternatively this fork/rebase can happen if a deadline is approaching. The only new commits made to `release` should be fixes and cleanups; no new features should be added to this branch. `release` and `prerelease` versions should be tagged through this branch.

`develop` - Development branch (possibly unstable). The `develop` branch is going to be the target for most the the PRs.

- Whenever a contributor is done with their issue/task they should open a PR targeting `develop` to be reviewed by a maintainer. After the code review pass is given the maintainer should then merge/rebase given PR into `develop`. 
  
- In addition to this, whenever a contributor wants to start working on a new issue/task they should create a new branch based on the latest commit of `develop`.

`hotfix` - Straight to production branch. The `hotfix` branch should always be up to date with `main`. Its purpose is to be a PR target for any **fix** that solves an issue in our production environment.

- If there is an issue in production a new working branch should be created to fix it. After that work is done a PR targeting `hotfix` should be opened. A maintainer will then review the PR, merge/rebase it into `hotfix`. As soon as the fix can be deployed `hotfix` should be merged/rebased into `main`, a new release made and published/deployed.

Between `main`, `release` and `hotfix` there's a representation in the repository of all the states of the application:
- `main` -> what is deployed (current prod env)
- `release` -> next release (future prod env)
- `hotfix` -> urgent fixes to be deployed (fix to current prod env)

If `main` and `hotfix` are on the same commit and there are no pressing issues open then we know prod env is stable.

If `main` and `release` are on the same commit the dapp is now maintenance mode until the next cycle.

Ideally all three of these branches will be up-to-date at the end of each release cycle.

### Github config
Only maintainers for the current cycle should have permissions to review and merge/rebase PRs into non-`main` long-lived branches. Only a subset of maintainers should have permission to merge/rebase PRs into `main`.

New commits in `main` should trigger a github action that goes through our pipeline and deploy the dapp.


### Naming conventions
In order to keep the repository clean and easy to sort through some naming conventions related to the workflow should be in place.

**Branches**

Branch names should have a subject followed by a short description of the work to be done in it. Example: `fix/rituals-tabs-styles` would be a branch to fix styling issues in the tabs used in the rituals page.

While the description is dependent on the nature of the work done, subjects are a bit more restrictive. Ideally they should be the same used in our commit messages which are defined by the [conventional commits standard](https://www.conventionalcommits.org/en/v1.0.0/).

Here is a list of all valid subjects for branches: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `revert`, `chore`.

(keep in mind `style` refers to code style, like the usage of whitespace and not CSS related issues).

**Commits** 

Everything you read above is also valid for commits as we are basing our branch naming convention on the conventional *commits* standard.
Example: `fix: adjusted padding for Tab component`.

To allow contributors to work without being overly concerned with naming conventions while still experimenting a new subject was added: `wip`. Keep in mind that this subject should **only be used for commits**. It also expected of the contributor to remove them from the git history of their working branch through `git rebase` before opening a PR.

### Gitflow

1. Contributor is assigned a development task (no `wip:` commits)
   1. Create new working branch from `develop` (see the convention above)
      1. `fix/rituals-tabs-style`
   2. Create commits on new branch (see the convention above)
      1. `fix: adjusted padding for Tab component`
   3. Open new PR targeting `develop` and wait for review
   
___

2. Contributor is assigned a development task (with `wip:` commits)
   1. Create new working branch `develop` (see the convention above)
      1. `fix/rituals-tabs-style`
   2. Create commits on new branch (see the convention above)
      1. `wip: added margin to Tab`
      2. `wip: removed margin in favor of padding`
      3. `wip: styles cleanup`
   3. squash and/or reword `wip:` commits with `git rebase`
      1. squash the 3 commits and reword to `fix: adjusted padding for Tab component`
   4. Open new PR targeting `develop` and wait for review

___
3. Maintainer needs to prepare next release
   1. Update your local `develop` branch
   2. Make sure dapp is running in the `dev` environment + running `yarn build` has no issues
   3. Merge `develop` into `release`
   4. Create `prerelase` version in the `release` branch through `yarn version:prerelease`
   5. Update the remote (github) `release` branch
   6. Iterate on `release` branch (almost exclusively fixes) and create new `prerelease` versions if applicable
   7. At the end of the cycle open PR targeting `main`
___
4. Maintainer needs to publish next release
   1. Update your local `release` branch
   2. Make sure dapp is running in the `dev` environment.
   3. Make sure dapp is running the prod build with no issues (`yarn build; yarn serve;`)
   4. Create `release` version in the `release` branch through `yarn version:release`
   5. Update the currently open PR targeting `main`
   6. Merge `release` into `main`
   7. github action should handle publishing/deploying

The flow for a `hotfix` should be very similar to 1/2 + 4 with the exception that 1/2 targets `hotfix` with the PR and 4 works in `hotfix` instead.
   1. New branch with hotfix is created from `main` (**not from** `develop`)
   2. PR targeting `hotfix` is created
   3. PR is reviewed + merged into `hotfix`
   4. Maintainer double checks if everything is okay locally
   5. PR is opened targeting `main`
   6. Maintainer with permissions to merge into `main` (meaning permission to deploy to prod) reviews PR
   7. New `release` version is created in `hotfix` (alternatively a version with a `hotfix` tag can be created)
   8. PR is updated with version tag commit
   9. PR is merged into `main`