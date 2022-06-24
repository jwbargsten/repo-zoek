#!/usr/bin/env python3

# az extension add --name azure-devops
# az devops configure --defaults organization=https://dev.azure.com/.../
# az devops configure --defaults project=...
# python contrib/az-devops.py >~/search/repos.ndjson

import os
import logging
import subprocess as sp
import json

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

repos = [
    {
        **repo,
        "name": repo["name"],
        "sshUrl": repo["sshUrl"],
        "url": repo["webUrl"],
        "diskUsage": repo["size"],
    }
    for repo in res
    if not repo["isDisabled"]
]
blacklist = []
repos = [r for r in repos if r["name"] not in blacklist]

for repo in repos:
    print(json.dumps(repo))
