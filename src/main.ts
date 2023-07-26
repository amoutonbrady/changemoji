import { $ } from "zx";
import { writeFileSync } from "node:fs";

interface Tag {
  name: string;
  date: string;
}

async function listTags(path: string): Promise<Tag[]> {
  const tags =
    await $`git -C ${path} for-each-ref --sort=taggerdate --format '%(refname:short) %(taggerdate:short)' refs/tags`.quiet();

  return tags.stdout
    .split("\n")
    .filter(Boolean)
    .map((tag) => {
      const [name, date] = tag.split(" ");
      return { name, date };
    });
}

// function that can list all the commits between two tags
async function listCommitsBetweenTags(
  path: string,
  tag1: Reference,
  tag2: Reference
) {
  const commits =
    await $`git -C ${path} log ${tag1.name}..${tag2.name} --pretty=format:'%h %s' --date=short`.quiet();

  const tag1Commit = await $`git -C ${path} rev-list -n 1 ${tag1.name}`.quiet();

  return `${tag1Commit.stdout.trim()}\n${commits.stdout.trim()}`
    .split("\n")
    .reverse()
    .filter(Boolean);
}

interface Commit {
  name: string;
  date: string;
}

async function getFirstCommit(path: string): Promise<Commit> {
  const firstCommit =
    await $`git -C ${path} rev-list --max-parents=0 HEAD --format='%h %cd' --date=short`.quiet();

  const [_, __, hash, date] = firstCommit.stdout
    .trim()
    .replace("\n", " ")
    .split(" ");

  return { name: hash, date };
}

async function getLastCommit(path: string): Promise<Commit> {
  const lastCommit =
    await $`git -C ${path} log -1 --format='%h %cd' --date=short HEAD`.quiet();

  const [hash, date] = lastCommit.stdout.trim().split(" ");

  return { name: hash, date };
}

const commitCategories: Record<string, RegExp> = {
  "New feature": /(:sparkles:)|(✨)|(🎉)|(🚀)|(🆕)/,
  "Bug fix": /(:bug:)|(🐛)/,
  "UI improvements": /(:art:)|(🎨)|(📝)|(💄)|(🔖)/,
  Internal: /(:construction:)|(🚧)|(👷)|(🔧)|(🔨)|(🌐)|(🛠️)|(🔩)/,
};

type CommitCategory = { name: string; commits: string[] };

function categorizeCommits(
  rawCommits: string[],
  categories: Record<string, RegExp>
) {
  const categorizedCommits = rawCommits.reduce<CommitCategory[]>(
    (acc, commit) => {
      const [hash, ...messageParts] = commit.split(" ");
      const message = messageParts.join(" ") + ` ([${hash}](#))`;

      const categoryName =
        Object.keys(categories).find((category) => {
          return categories[category].test(message);
        }) || "Other";

      const category = acc.find((category) => category.name === categoryName);

      if (category) {
        category.commits.push(message);
      } else {
        acc.push({
          name: categoryName,
          commits: [message],
        });
      }

      return acc;
    },
    [] as CommitCategory[]
  );

  return categorizedCommits.sort((a, b) => {
    if (a.name === "Other") return 1;
    if (b.name === "Other") return -1;

    const indexA = Object.keys(categories).indexOf(a.name);
    const indexB = Object.keys(categories).indexOf(b.name);
    return indexA - indexB;
  });
}

type Reference = Tag | Commit;

async function isGitRepository(path: string) {
  try {
    await $`git -C ${path} rev-parse --is-inside-work-tree`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // get the path from the command line arguments
  const path = process.argv[2] || ".";

  if (!(await isGitRepository(path))) {
    console.error("The path is not a git repository");
    return process.exit(1);
  }

  const tags = await listTags(path);

  const tagsPlusFirstCommit: Reference[] = [
    await getFirstCommit(path),
    ...tags,
    await getLastCommit(path),
  ];

  const releases: Record<string, CommitCategory[]> = {};

  // generate all the commits between each tags
  for (let i = 0; i < tagsPlusFirstCommit.length - 1; i++) {
    const tag1 = tagsPlusFirstCommit[i];
    const tag2 = tagsPlusFirstCommit[i + 1];

    console.log(`Commits between ${tag1.name} and ${tag2.name}`);

    const rawCommits = await listCommitsBetweenTags(path, tag1, tag2);
    const categorizedCommits = categorizeCommits(rawCommits, commitCategories);

    if (i === 0) {
      releases[`[pre-1.0.0](${tag1.name}...${tag2.name})`] = categorizedCommits;
    } else if (i === tagsPlusFirstCommit.length - 2) {
      releases[`[Unreleased](${tag1.name}...${tag2.name})`] =
        categorizedCommits;
    } else {
      releases[`[${tag2.name}](${tag1.name}...${tag2.name}) (${tag2.date})`] =
        categorizedCommits;
    }
  }

  writeFileSync(
    "./CHANGELOG.md",
    "# Changelog\n\n" +
      Object.entries(releases)
        .reverse()
        .map(([release, categories]) => {
          return (
            `## ${release}\n\n` +
            categories
              .map((category) => {
                return (
                  `### ${category.name}\n\n` +
                  category.commits
                    .map((commit) => {
                      return `- ${commit}`;
                    })
                    .join("\n") +
                  "\n"
                );
              })
              .join("\n")
          );
        })
        .join("\n")
  );

  process.exit(0);
}

main().catch(() => process.exit(1));
