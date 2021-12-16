# GitHub Linear sync

## How to make changes

1. Make the required changes
2. Compile the `src/index.js` (otherwise the `node_modules` need to be incorporated inside the
   repo).

### Compiling

> [source](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action#commit-tag-and-push-your-action-to-github)

```sh
npm i -g @vercel/ncc
npm i
ncc build src/index.js
```

### Useful links

- [issue events that trigger workflows](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#issues)
- [issue event payload](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#issues)

## Example usage

```yaml
on:
  issues:
    types: [opened, edited, closed, reopened]

jobs:
  linear_sync_job:
    runs-on: ubuntu-latest
    name: Sync GitHub issue to Linear
    steps:
      # To use this repository's private action,
      # you must check out the repository
      - name: Checkout
        uses: actions/checkout@v2

      - name: Sync issue
        # Uses an action in the root directory
        uses: ./github-linear-sync/
        env:
          LINEAR_KEY: ${{ secrets.LINEAR_KEY }}
          LINEAR_TEAM_ID: ${{ secrets.LINEAR_TEAM_ID }}
```

## Notes regarding the implementation

### Webhook server hosting is faster than GitHub Actions

GitHub Actions run on webhook events and so eleviate the need to run your own server that receives
webhooks. However, of course, the dependencies need to be set up for every webhook (since Actions
run in containers) whilst on your own server they don't. Meaning that hosting it yourself is faster!

So it is speed vs ease of implementation.

### Linear SDK vs GraphQL API

Some facts:

- Linear themselves recommend using their SDK.
- Arguably, coding using the SDK is easier to maintain and is in general clearer to everyone.

### Workflow template within GitHub org

> [source](https://docs.github.com/en/actions/learn-github-actions/sharing-workflows-with-your-organization)
> "Note: Workflow templates can be used to create new workflows in an organization' s public
> repository; to use templates to create workflows in private repositories, the organization must be
> part of an enterprise plan."

So to use this action in every repo, we would have to copy and paste it everywhere. Or use
submodules.
