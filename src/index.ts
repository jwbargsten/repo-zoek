#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as readline from "node:readline";

import { InvalidArgumentError, program } from "commander";
import inquirer from "inquirer";

import { getAllRepos, getOrgs } from "./query";
import { Config, currentBranch, execGit, expandPath, log, pkgName, pkgVersion } from "./utils";

function parseProjectDir(dir: any): string {
  const d = dir || process.env["REPO_ZOEK_DIR"];

  if (!d) {
    program.error("no repo zoek project dir supplied");
  }
  const configFile = path.join(expandPath(d), Config.configFileName);
  if (!fs.existsSync(configFile)) {
    throw new InvalidArgumentError(`repo zoek dir not valid, config file ${configFile} not found`);
  }

  return dir;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function actionSyncIndex(dir: any, _opts: any, _cmd: any) {
  const config = new Config(parseProjectDir(dir)).load();
  const indexPathAbs = path.resolve(config.indexPath);

  process.chdir(config.reposPath);

  const blacklist = config.data.blacklist || [];
  const repos = fs
    .readdirSync(".", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      if (blacklist.includes(entry.name)) {
        log.warn(`skipping repo ${entry.name}, blacklisted`);
        return false;
      }
      return true;
    })
    .map((entry) => entry.name);

  fs.mkdirSync(indexPathAbs, { recursive: true });

  repos.forEach((repo) => {
    const res = spawnSync("zoekt-index", ["-index", indexPathAbs, repo], {
      stdio: ["ignore", process.stdout, process.stderr],
    });
    if (res.status !== 0) {
      log.error(`error while indexing repo ${repo}`);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function actionOrgList(dir: any, _opts: any, _cmd: any) {
  const config = new Config(parseProjectDir(dir)).load();
  log.info(JSON.stringify(await getOrgs({ baseUrl: config.data?.ghBaseUrl }), null, 2));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function actionOrgSet(orgLogin: any, dir: any, _opts: any, _cmd: any) {
  const config = new Config(parseProjectDir(dir)).load();
  log.info(`current org login: ${config.data?.orgLogin}`);
  const data = { ...config.data, orgLogin };
  config.save(data);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function actionSyncRepos(dir: any, opts: any, _cmd: any) {
  const withHistory = !!opts?.full;
  const config = new Config(parseProjectDir(dir)).load();
  fs.mkdirSync(config.reposPath, { recursive: true });

  const repolistStream = fs.createReadStream(config.repolistPath);

  const rl = readline.createInterface({
    input: repolistStream,
  });

  const { blacklist = [], maxDiskUsageInKb } = config.data;
  for await (const line of rl) {
    const repo = JSON.parse(line);
    const repoPath = path.join(config.reposPath, repo.name);
    log.info(`${repo.name} ${repo.diskUsage} (${repoPath})`);

    if (blacklist.includes(repo.name)) {
      log.warn(`skipping repo ${repo.name}, blacklisted`);
      continue;
    }

    if (repo.diskUsage && maxDiskUsageInKb && repo.diskUsage > maxDiskUsageInKb) {
      log.warn(`skipping repo ${repo.name}, too big (${repo.diskUsage} kb)`);
      continue;
    }

    if (repo.name && fs.existsSync(repoPath) && withHistory) {
      execGit(["pull"], repoPath);
    } else if (repo.name && fs.existsSync(repoPath)) {
      const branch = currentBranch(repoPath);
      // https://stackoverflow.com/questions/41075972/how-to-update-a-git-shallow-clone
      if (!execGit(["fetch", "--depth", "1"], repoPath)) {
        continue;
      }
      if (!execGit(["reset", "--hard", `origin/${branch}`], repoPath)) {
        continue;
      }
      execGit(["clean", "-dfx"], repoPath);
    } else if (repo.name && repo.sshUrl && withHistory) {
      execGit(["clone", repo.sshUrl, repoPath]);
    } else if (repo.name && repo.sshUrl) {
      execGit(["clone", "--single-branch", "--filter=blob:none", "--depth=1", repo.sshUrl, repoPath]);
    } else {
      log.warn(`clould not clone/pull ${repo.name}`);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function actionSyncRepolist(dir: any, _opts: any, _cmd: any) {
  const config = new Config(parseProjectDir(dir)).load();

  const writeStream = fs.createWriteStream(config.repolistPath);

  const repoIterator = getAllRepos({ orgLogin: config.data?.orgLogin, baseUrl: config.data?.ghBaseUrl });

  // const blacklist = config.data.blacklist || [];

  for await (const reploListPage of repoIterator) {
    reploListPage.organization.repositories.nodes.forEach((repo) => {
      /*
      not needed for now
      if (blacklist.includes(repo.name)) {
        log.warn(`\nskipping repo ${repo.name}, blacklisted`);
        return;
      }
      */
      writeStream.write(JSON.stringify(repo) + "\n", "utf8");
      process.stdout.write(".");
    });
  }

  writeStream.on("finish", () => {
    process.stdout.write("\n");
    log.info(`wrote all repo data to ${config.repolistPath}`);
  });
  writeStream.end();
}

async function actionInit(dir: any) {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "basePath",
      message: "Where should I store the cloned repos and the search index?",
      validate: (input: string): boolean => !!input,
      default: dir || process.env["REPO_ZOEK_DIR"] || "~/repo-search",
    },
    {
      type: "input",
      name: "ghBaseUrl",
      message: "Github API base URL (leave empty if you don't use enterprise)",
      default: "",
    },
    {
      type: "input",
      name: "orgLogin",
      message: "What is the login name of the organisation (if you don't know yet, leave empty)",
      default: "",
    },
  ]);

  const config = new Config(answers.basePath);
  config.init(answers);
  log.info(`add "REPO_ZOEK_DIR=${config.basePath}" to your env or use ${config.basePath} in the CLI`);
}

(async () => {
  program.name(pkgName).description("Lists, pulls and indexes github repos").version(pkgVersion);

  program
    .command("init")
    .description("init repo search project")
    .argument("[dir]", "repo-zoek project dir", process.env["REPO_ZOEK_DIR"])
    .action(actionInit);
  const orgCmd = program.command("org").description("organisation related commands");

  orgCmd
    .command("list")
    .description("list organisations")
    .argument("[dir]", "repo-zoek project dir")
    .action(actionOrgList);

  orgCmd
    .command("set")
    .description("set the organisation")
    .argument("<login>", "organisation login name")
    .argument("[dir]", "repo-zoek project dir")
    .action(actionOrgSet);

  const syncCmd = program.command("sync").description("sync data, index and repos");
  syncCmd
    .command("repolist")
    .description("query github API and cache the repo list")
    .argument("[dir]", "repo-zoek project dir")
    .action(actionSyncRepolist);
  syncCmd
    .command("repos")
    .description("clone or pull repos from cached repo list")
    .argument("[dir]", "repo-zoek project dir")
    .option(
      "-f --full",
      "does a full (with all history & branches) checkout/pull instead of only the newest commit on master"
    )
    .action(actionSyncRepos);
  syncCmd.command("index").description("update the zoekt index").action(actionSyncIndex);
  syncCmd
    .command("all")
    .description("run sync repolist, repos & index")
    .argument("[dir]", "repo-zoek project dir")
    .option(
      "-f --full",
      "does a full (with all history & branches) checkout/pull instead of only the newest commit on master"
    )
    .action(async (dir: any, opts: any, cmd: any) => {
      await actionSyncRepolist(dir, opts, cmd);
      await actionSyncRepos(dir, opts, cmd);
      await actionSyncIndex(dir, opts, cmd);
    });

  program.addHelpText(
    "after",
    `
Zoekt resources:
  https://github.com/sourcegraph/zoekt/blob/master/doc/design.md
  https://github.com/sourcegraph/zoekt/blob/master/doc/faq.md
  https://cs.bazel.build/
`
  );

  await program.parseAsync(process.argv);
})();
