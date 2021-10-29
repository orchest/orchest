const core = require("@actions/core");
const github = require("@actions/github");
const LinearClient = require("@linear/sdk").LinearClient;

// Linear settings.
const client = new LinearClient({
  apiKey: process.env.LINEAR_KEY,
});

const teamId = process.env.LINEAR_TEAM_ID;

// TODO: we might also want to include "tracker"
// Mapping from GitHub label name to Linear label ID.
// NOTE: We don't care about other labels that are assigned to issues on
// GitHub as those labels are for public communication.
const labelMap = {
  bug: "72a5a485-9fec-4d9d-84c6-e2fb7f6578dd",
  improvement: "6a134037-3a03-4b6d-9c6e-db7c78b2b23b",
  "new feature request": "4f128807-1e3e-4a74-852b-283b08fc4f02",
  OSS: "4dcdd86b-e0a3-4d4a-a65d-b363f49dfaf4",
};

// Mapping from Linear status name to Linear ID.
const statusMap = {
  // Status we want "opened" issues to be in.
  triage: "8fb3a36f-230e-4af3-8a34-830818ab6f71",
  // "closed" in GitHub.
  done: "157363bd-b118-44db-8876-726ed5fb9b04",
};

function IssueNotUniqueError(message) {
  this.message = message;
  this.name = "IssueNotUniqueError";
}

function IssueNotFoundException(message) {
  this.message = message;
  this.name = "IssueNotFoundException";
}

async function _getLinearIssueId(GHIssueUrl, includeArchived = false) {
  // NOTE: Sadly, the `client.issues` method does not yet expose the
  // newly added `filter` variable to search for an exact comment body.
  // For the time being `issueSearches` will do, which searches the
  // issue title and description (but not comments).
  const query = createIdentifierMsg(GHIssueUrl);
  const search_result = await client.issueSearch(query, {
    includeArchived: includeArchived,
  });
  const issues = search_result.nodes;

  // The comment should be unique because it contains the unique
  // identifier of the GitHub issue, e.g. 461.
  if (issues.length > 1) {
    throw new IssueNotUniqueError("Issue identifier is not unique.");
  } else if (issues.length === 0) {
    throw new IssueNotFoundException(
      "No issue found that matches the given identifier."
    );
  }

  return issues[0].id;
}

// Closed or cancelled issues are auto-archived in Linear after 1 month.
async function getLinearIssueId(GHIssueUrl, includeArchived = false) {
  try {
    return await _getLinearIssueId(GHIssueUrl, includeArchived);
  } catch (error) {
    if (error instanceof IssueNotUniqueError) {
      throw error;
    } else if (error instanceof IssueNotFoundException) {
      // Sadly, Linear automatically rendered links as markdown links during
      // the migration. So to make sure the Linear integration also works
      // for the migrated (from Jira) tickets, we need to do an additional
      // query.
      return _getLinearIssueId(
        `[${GHIssueUrl}](${GHIssueUrl})`,
        includeArchived
      );
    } else {
      throw error;
    }
  }
}

function createIdentifierMsg(GHIssueURL) {
  return `Unique identifier message for: ${GHIssueURL}`;
}

async function handleAction(payload) {
  const issueContent = payload.issue;

  // We only sync the labels that are defined in the `labelMap`.
  let labelIds = issueContent.labels
    .map((label) => labelMap[label.name])
    .filter((label) => label !== undefined);
  // Always include the "OSS" label.
  labelIds.push(labelMap.OSS);

  try {
    switch (payload.action) {
      case "opened":
        const newIssue = await client.issueCreate({
          teamId: teamId,
          title: issueContent.title,
          description: createIdentifierMsg(issueContent.html_url),
          labelIds: labelIds,
          // Issues that come in through the GitHub integration should be
          // triaged first, since they could be user bugs.
          stateId: statusMap.triage,
        });

        // NOTE: Even though we don't yet use the comments, they need to
        // be there for once we start using the comments for
        // identification. Otherwise previously opened GitHub issues will
        // not have the needed comment.
        // Create the comment that we will use to identify the issue with.
        return client.commentCreate({
          issueId: (await newIssue.issue).id,
          body: createIdentifierMsg(issueContent.html_url),
        });

      case "edited":
        // We only care about title changes so that it is easier to
        // mentally link a GitHub and Linear issue.
        if (payload.changes.title === undefined) {
          break;
        }

        return client.issueUpdate(
          await getLinearIssueId(issueContent.html_url),
          { title: issueContent.title }
        );

      case "closed":
        return client.issueUpdate(
          await getLinearIssueId(issueContent.html_url),
          { stateId: statusMap.done }
        );

      case "reopened":
        // Also search the archived issues on Linear.
        return client.issueUpdate(
          await getLinearIssueId(issueContent.html_url, true),
          { stateId: statusMap.triage }
        );

      // NOTE: Let's exclude this through GitHub Actions for now, since
      // changing labels of old issues would require the archive to be
      // searched. This can be slow and we don't really care about the
      // label change.
      case "unlabeled":
      case "labeled":
        return client.issueUpdate(
          await getLinearIssueId(issueContent.html_url),
          { labelIds: labelIds }
        );

      default:
        throw "Unsupported action.";
    }
  } catch (error) {
    console.log(error.name + ": " + error.message);
    throw error;
  }
}

async function main() {
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2);
  console.log(`The event payload: ${payload}`);

  return handleAction(github.context.payload);
}

main()
  .then(() => {
    console.log("Successfully synced issue changes to Linear.");
  })
  .catch((error) => {
    console.log("Failed to sync issue to Linear.");
    core.setFailed(error.message);
  });
