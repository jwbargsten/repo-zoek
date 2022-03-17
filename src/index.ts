#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as readline from "node:readline";

import { program } from "commander";
import inquirer from "inquirer";

import { getAllRepos, getOrgs } from "./query";
import { Config, currentBranch, execGit, log, pkgName, pkgVersion } from "./utils";

async function actionSyncIndex(_opts: any, cmd: any) {
  const config = new Config(cmd.optsWithGlobals()?.dir).load();
  const indexPathAbs = path.resolve(config.indexPath);

  process.chdir(config.reposPath);

  const repos = fs
    .readdirSync(".", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
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

async function actionOrgSet(orgLogin: any, _opts: any, cmd: any) {
  const config = new Config(cmd.optsWithGlobals()?.dir).load();
  log.info(`current org login: ${config.data?.orgLogin}`);
  const data = { ...config.data, orgLogin };
  config.save(data);
}

async function actionSyncRepos(_: any, cmd: any) {
  const config = new Config(cmd.optsWithGlobals()?.dir).load();
  fs.mkdirSync(config.reposPath, { recursive: true });

  const repolistStream = fs.createReadStream(config.repolistPath);

  const rl = readline.createInterface({
    input: repolistStream,
  });

  for await (const line of rl) {
    const repo = JSON.parse(line);
    const repoPath = path.join(config.reposPath, repo.name);
    log.info(`${repo.name} ${repo.diskUsage} (${repoPath})`);
    if (repo.name && fs.existsSync(repoPath)) {
      const branch = currentBranch(repoPath);
      // https://stackoverflow.com/questions/41075972/how-to-update-a-git-shallow-clone
      if (!execGit(["fetch", "--depth", "1"], repoPath)) {
        continue;
      }
      if (!execGit(["reset", "--hard", `origin/${branch}`], repoPath)) {
        continue;
      }
      execGit(["clean", "-dfx"], repoPath);
    } else if (repo.name && repo.sshUrl) {
      execGit(["clone", "--single-branch", "--filter=blob:none", "--depth=1", repo.sshUrl, repoPath]);
    } else {
      log.warn(`clould not clone ${repo.name}`);
    }
  }
}

async function actionSyncRepolist(_: any, cmd: any) {
  const config = new Config(cmd.optsWithGlobals()?.dir).load();

  const writeStream = fs.createWriteStream(config.repolistPath);

  const repoIterator = getAllRepos({ orgLogin: config.data?.orgLogin });

  for await (const reploListPage of repoIterator) {
    reploListPage.organization.repositories.nodes.forEach((repo) => {
      writeStream.write(JSON.stringify(repo) + "\n", "utf8");
    });
  }

  writeStream.on("finish", () => {
    log.info(`wrote all repo data to ${config.repolistPath}`);
  });
  writeStream.end();
}

async function actionInit() {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "apiBasePath",
      message: "Github API base path (leave empty if you don't use enterprise)",
      default: "",
    },
    {
      type: "input",
      name: "basePath",
      message: "Where should I store the cloned repos and the search index?",
      validate: (input: string): boolean => !!input,
      default: process.env["REPO_ZOEK_DIR"] || "~/repo-search",
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
  log.info(`add "REPO_ZOEK_DIR=${config.basePath}" to your env or use --dir ${config.basePath} in the CLI`);
}

(async () => {
  program.name(pkgName).description("Lists, pulls and indexes github repos").version(pkgVersion);

  program.command("init").description("init repo search project").action(actionInit);
  const orgCmd = program.command("org").description("organisation related commands");
  orgCmd
    .command("list")
    .description("list organisations")
    .action(async () => console.log(JSON.stringify(await getOrgs(), null, 2)));

  orgCmd
    .command("set")
    .description("set the organisation")
    .requiredOption("-d, --dir <path>", "repo-zoek dir", process.env["REPO_ZOEK_DIR"])
    .argument("<login>", "organisation login name")
    .action(actionOrgSet);

  const syncCmd = program
    .command("sync")
    .description("sync data, index and repos")
    .requiredOption("-d, --dir <path>", "repo-zoek dir", process.env["DREPO_ZOEK_DIR"]);
  syncCmd
    .command("repolist")
    .description("query github API and cache the repo list")
    .action(actionSyncRepolist);
  syncCmd.command("repos").description("clone or pull repos from cached repo list").action(actionSyncRepos);
  syncCmd.command("index").description("update the zoekt index").action(actionSyncIndex);
  syncCmd
    .command("all")
    .description("run sync repolist, repos & index")
    .action(async (opts: any, cmd: any) => {
      await actionSyncRepolist(opts, cmd);
      await actionSyncRepos(opts, cmd);
      await actionSyncIndex(opts, cmd);
    });

  await program.parseAsync(process.argv);
})();
