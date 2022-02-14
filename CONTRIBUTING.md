# Contributing

Thank you for investing your time in contributing to our project! 

In this guide you will get an overview of the contribution workflow from opening an issue, creating a PR, reviewing, and merging the PR.

## Issues
### Creating an issue
Issues are very valuable to this project.

  - Ideas are a valuable source of contributions others can make
  - Problems show where this project is lacking
  - With a question you show where contributors can improve the user
    experience

Prior to creating issues, please search to ensure that a similar issue does not already exist.

Thank you creating them.

### Working on an issue
Prior to working on an issue, it is worth checking with the team that no one else is working on the issue already - we would hate for any hard work to go to waste due to duplication. We're usually pretty good at assigning issues to developers that are working on them but it is worth just posting a comment making sure if it is not assigned. 

First time contributing to the project? Use the `good first issue` label to see where we've identified good vectors to jump into contributing. 

## Pull Requests

Pull requests are a great way to get your ideas into this repository.

When deciding if we merge in a pull request we look at the following
things:

### Does it state intent

If the PR is not directly related to an issue, you should be clear which problem you're trying to solve with your contribution.

For example:

> Add link to code of conduct in README.md

Doesn't tell us anything about why you're doing that

> Add link to code of conduct in README.md because users don't always
> look in the CONTRIBUTING.md

Tells us the problem that you have found, and the pull request shows us
the action you have taken to solve it.

### Is it of good quality

  - There are no spelling mistakes
  - It reads well
  - All commit messages follow the expected format `(fix|chore|feat|docs):<short description>` - it is worth pointing out that PRs with many commits will likely be squashed when merged - unless there is a good reason to keep the commits separate
  - Is it targeting the correct branch? By default, PRs should target the `stage` branch, rather than `main`
  - If you're solving an issue, is it [linked to the appropriate issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)?

### Reviews
All PRs will need to be reviewed by a member of the core-devs before it can be merged into one of the protected branches. 

This isn't to say that we do not welcome PR reviews from non core-dev member, rather we encourage it! However, we expect all code reviews to follow these guidelines:

* Be respectful when leaving feedback - you are commenting on the code, not the individual (e.g. rather than say `your for loop is terrible; it could be made better by...` you could say `this for loop isn't the most optimal; here is how it could be improved...`). Conversely, when receiving feedback, remember that the reviewer is commenting on the code and not you personally. Criticism is hard to give and receive but ultimately will make for better software
* Collect multiple occurrences into a single comment - rather than comment on every line/occurrence of, say, usage of double quotes rather than single - collect into a single comment to be addressed collectively
* For larger PRs, multiple rounds of review may be required - this helps the reviewer by not requiring large amounts of LOC to be read and the submitter by being able to enter an active feedback cycle with the reviewer

Once the PR has passed all the status checks required, it will then be squashed and merged into the target branch by one of the core-dev team. 