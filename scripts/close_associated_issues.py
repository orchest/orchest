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
    pattern = r"Fixes: (#\d+(?:\, )?)*"
    match = re.search(pattern, body)

    if match is None:
        return []

    issue_numbers = match.group(0).lstrip("Fixes: ").split(", ")
    return [num.lstrip("#") for num in issue_numbers]


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
