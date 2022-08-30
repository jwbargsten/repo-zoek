import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import chalk from "chalk";

import { name as pkgName } from "../package.json";

export { name as pkgName, version as pkgVersion } from "../package.json";

export type ConfigData = {
  ghBaseUrl?: string;
  orgLogin?: string;
  basePath?: string;
  blacklist?: string[];
  maxDiskUsageInKb?: number;
  cloneUrlField: string;
};

export const log = {
  info: (msg: unknown) => console.log(chalk.blue(msg)),
  error: (msg: unknown) => console.log(chalk.red(msg)),
  warn: (msg: unknown) => console.log(chalk.yellow(msg)),
};

export function expandPath(p: string): string {
  if (!p) {
    return "";
  }
  const parts = p.split(path.sep);
  if (parts[0] === "~") {
    parts[0] = os.homedir();
  }
  return parts.join(path.sep);
}

export class Config {
  static configFileName = `${pkgName}.conf.json`;

  static repolistFileName = "repos.ndjson";

  basePath: string;

  path: string;

  data: ConfigData;

  repolistPath: string;

  reposPath: string;

  indexPath: string;

  constructor(basePath: string) {
    this.basePath = expandPath(basePath);
    this.path = path.join(this.basePath, Config.configFileName);
    this.repolistPath = path.join(this.basePath, Config.repolistFileName);
    this.reposPath = path.join(this.basePath, "repos");
    this.indexPath = path.join(this.basePath, "index");

    this.data = { cloneUrlField: "sshUrl" };
  }

  init(data: ConfigData) {
    if (fs.existsSync(this.basePath)) {
      log.error(`base path ${this.basePath} already exists!`);
      throw new Error(`basepath ${this.basePath} exists`);
    }

    log.info(`creating ${this.basePath}`);
    fs.mkdirSync(this.basePath, { recursive: true });

    return this.save(data);
  }

  save(data: ConfigData) {
    if (!fs.existsSync(this.basePath)) {
      log.error(`base path ${this.basePath} does not exist!`);
    }
    fs.writeFileSync(this.path, JSON.stringify(data, null, 2) + "\n");
    log.info(`saving config settings to ${this.path}`);
    this.data = data;
    return this;
  }

  load() {
    if (!fs.existsSync(this.path)) {
      log.error(`${this.path} does not exist`);
      throw new Error(`config file ${this.path} does not exist`);
    }
    this.data = JSON.parse(fs.readFileSync(this.path, "utf-8")) as ConfigData;
    return this;
  }
}

export function currentBranch(repoPath: string) {
  const git = spawnSync("git", ["-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf8",
  });
  return git.status === 0 ? git.stdout.trim() : null;
}

export function execGit(args: string[], repoPath: string | null = null): boolean {
  const fullArgs = repoPath ? ["-C", repoPath, ...args] : args;
  // log.info(["git", ...fullArgs].join(" "));
  const git = spawnSync("git", fullArgs, {
    stdio: ["ignore", process.stdout, process.stderr],
    encoding: "utf8",
  });
  if (git.status !== 0) {
    log.error(`git error`);
    return false;
  }
  return true;
}
