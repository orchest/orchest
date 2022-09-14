from __future__ import annotations

import os
import re
import sys
from http import client

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")


def close_issue(conn: client.HTTPSConnection, issue_number: str) -> bool:
    api_path = "/repos/orchest/orchest/issues/{issue_number}"
    issue_url = api_path.format(issue_number=issue_number)
    conn.request(
        "PATCH",
        issue_url,
        '{"state": "closed"}',
        headers={
            "Accept": "application/vnd.github.v3+json",
            "Authorization": f"token {GITHUB_TOKEN}",
            "User-Agent": "request",
        },
    )
    r = conn.getresponse()

    # NOTE: the whole response must have been read before a new
    # request can be send to the server. Since we want to reuse
    # the connection, we need to read the response.
    r.read()

    return r.status == 200


def get_issues_from_pr_body(body: str) -> list[str]:
    body = body.lower()

    # NOTE: In Python it is not possible to repeat capturing groups
    # using operators like `*` and `+`. Therefore the regex just needs
    # to match the entire pattern and we then process on the entire
    # match.
    pattern = r"^(fix|clos|resolv)(e|es|ed)?:? (#\d+(\, )?)+"

    # Compiling is more efficient because the expression will be used
    # several times.
    prog = re.compile(pattern)

    res = []
    for line in body.split("\n"):
        match = prog.search(line)

        if match is None:
            continue

        match = match[0]
        raw_issue_numbers = match[match.index("#") :].split(", ")
        res.extend([num.lstrip("#") for num in raw_issue_numbers])

    return res


# For development only.
def _test_get_issues_from_pr_body():
    bodies = [
        # All words.
        "Fix: #316",
        "Fixes: #316",
        "Fixed: #316",
        "Close: #316",
        "Closes: #316",
        "Closed: #316",
        "Resolve: #316",
        "Resolves: #316",
        "Resolved: #316",
        # Without optional `:`
        "Fix #316",
        # Multiple issues to close
        "Fixes: #316, #67, #89",
        # Multiple lines
        "Resolved: #316\nResolved: #380",
        # Multiple lines and issues
        "Resolved: #316, #89\nResolved: #380",
        # Regular PR body
        "This PR is to do bla bla..\nbla bla\nbla\ncloses #10",
    ]
    answers = [
        ["316"],
        ["316"],
        ["316"],
        ["316"],
        ["316"],
        ["316"],
        ["316"],
        ["316"],
        ["316"],
        ["316"],
        ["316", "67", "89"],
        ["316", "380"],
        ["316", "89", "380"],
        ["10"],
    ]

    for body, ans in zip(bodies, answers):
        issues = get_issues_from_pr_body(body)

        assert issues == ans


def main():
    pr_body = os.environ.get("PR_BODY")
    if pr_body is None:
        print("Could not read PR body.")
        sys.exit(1)
    else:
        print(f"{pr_body}\n\n")

    issue_numbers = get_issues_from_pr_body(pr_body)
    if issue_numbers:
        print("Found issues to close:", ", ".join(issue_numbers))
    else:
        print("Did not find any issues to close.")
        sys.exit(0)

    conn = client.HTTPSConnection("api.github.com")
    could_close = [close_issue(conn, issue_number) for issue_number in issue_numbers]

    if not all(could_close):
        # Failed to close all issues linked in the PR.
        failed_to_close = [
            num for is_closed, num in zip(could_close, issue_numbers) if not is_closed
        ]
        print("Failed to close issues:", ", ".join(failed_to_close))
        sys.exit(1)


if __name__ == "__main__":
    main()
