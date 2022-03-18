#!/usr/bin/env python3

import json
import subprocess as sp
import os
from pathlib import Path

repos = []
with open("x.ndjson", "r") as fd:
    for raw in fd:
        data = json.loads(raw)
        repos.extend(data["organization"]["repositories"]["nodes"])

os.chdir("/Users/jbargsten/search/repos/")
usage = 0
for r in repos:
    print(r["name"], r["diskUsage"])
    a = Path(r["name"])

    if r["name"] and Path(r["name"]).exists():
        sp.run(["zoekt-index", "-index", "/home/abc/search/index", r["name"]])
        continue
    if r["diskUsage"] is not None and r["diskUsage"] > 1417334:
        print("TOO BIG " + r["name"])
        continue
    if r["sshUrl"] and r["name"]:
        cmd = ["git", "clone", "--filter=blob:none", "--depth=1", r["sshUrl"]]
        print(" ".join(cmd))
        sp.run(cmd)
        sp.run(["zoekt-index", "-index", "/home/abc/search/index", r["name"]])
    else:
        print("could not clone " + r["name"])
