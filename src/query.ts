/* eslint-disable no-await-in-loop */
import { Octokit } from "@octokit/core";

import { log } from "./utils";

function initOctokit(baseUrl?: string | null): Octokit {
  const PAT = process.env["GITHUB_PAT"];

  if (!PAT) {
    log.warn("Environment variable GITHUB_PAT not set. It is needed for querying github.");
    throw new Error("Environment variable GITHUB_PAT not set. It is needed for querying github.");
  }

  return baseUrl ? new Octokit({ auth: PAT, baseUrl }) : new Octokit({ auth: PAT });
}

interface Repo {
  name: string;
  createdAt: string;
  diskUsage: null | number;
  isDisabled: boolean;
  isEmpty: boolean;
  labels: {
    nodes: { name: string }[];
  };
  primaryLanguage: {
    name: string;
  };
  cloneUrl: string;
  url: string;
}

interface RepoListPage {
  organization: {
    name: string;
    login: string;
    repositories: {
      nodes: Repo[];
      pageInfo: {
        endCursor: string | null;
        hasNextPage: boolean;
      };
      totalCount: number;
    };
  };
}

export function getOrgs({ baseUrl }: { baseUrl?: string | null }) {
  const octokit = initOctokit(baseUrl);
  return octokit.graphql(`
  query orgs {
    viewer {
      login
      organizations(first: 10) {
        nodes {
          login
          repositories {
            totalCount
          }
        }
      }
    }
  }
`);
}

const delay = (ms: number) =>
  new Promise((res) => {
    setTimeout(res, ms);
  });

const hasNextPage = (repos: RepoListPage) => repos?.organization?.repositories?.pageInfo?.hasNextPage ?? true;
const afterCursor = (repos: RepoListPage) => repos?.organization?.repositories?.pageInfo?.endCursor ?? null;

//  https://docs.github.com/en/graphql/overview/explorer
export async function* getAllRepos({
  orgLogin,
  baseUrl,
  cloneUrlField = "sshUrl",
}: {
  orgLogin?: string;
  baseUrl?: string | null;
  cloneUrlField?: string;
}) {
  if (!orgLogin) {
    throw new Error("organisation login name");
  }

  const octokit = initOctokit(baseUrl);

  let hasNext = true;
  let startAt = null;
  while (hasNext) {
    const response: RepoListPage = await octokit.graphql(
      `query repos($orgLogin: String!, $after: String, $first: Int) {
      organization(login: $orgLogin) {
        name
        login
        repositories(after: $after, first: $first) {
          nodes {
            name
            createdAt
            diskUsage
            isDisabled
            isEmpty
            labels(first: 10) {
              nodes {
                name
              }
            }
            primaryLanguage {
              name
            }
            cloneUrl: ${cloneUrlField}
            url
          }
          pageInfo {
            endCursor
            hasNextPage
          }
          totalCount
        }
      }
      rateLimit {
        cost
        remaining
        resetAt
      }
    }`,
      { orgLogin, after: startAt, first: 80 }
    );
    hasNext = hasNextPage(response);
    startAt = afterCursor(response);

    yield response;
    await delay(3000);
  }
}
