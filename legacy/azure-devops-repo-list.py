#!/usr/bin/env python3

import os
import logging
import subprocess as sp
import json
from pathlib import Path

log_dfmt = "%Y-%m-%d %H:%M:%S"
log_fmt = "%(asctime)s - %(levelname)-8s - %(name)s.%(funcName)s: %(message)s"
logging.basicConfig(level=logging.DEBUG, format=log_fmt, datefmt=log_dfmt)

logger = logging.getLogger(__name__)


def az_cmd(cmd, capture=True):
    # take care of strange macos behaviour
    env = os.environ
    env.pop("__PYVENV_LAUNCHER__", None)
    logger.info(f"running cmd: {' '.join(cmd)}")
    res = sp.run(cmd, capture_output=capture, env=env, check=True)
    if not capture:
        return None
    return json.loads(res.stdout.decode("utf-8"))


res = az_cmd(["az", "repos", "list"])

repos = [(repo["name"], repo["sshUrl"]) for repo in res]
blacklist = []
repos = [r for r in repos if r[0] not in blacklist]

for repo in repos:
    if Path(repo[0]).exists():
        logger.error(f"{repo[0]} does already exist")
        sp.run(["git", "-C", repo[0], "pull"])
        continue
    logger.info(f"{repo[0]} -> {repo[1]}")
    sp.run(["git", "clone", repo[1]], env=os.environ, check=True)
