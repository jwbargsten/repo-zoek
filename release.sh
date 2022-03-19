#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset

if ! git diff-index --quiet HEAD --; then
  echo "uncommitted changes"
  exit 1 
fi


npm run dist
version=$(<package.json jq -r .version)
name=$(<package.json jq -r .name)

file="$name-$version.tgz"
tag="v$version"

git tag "$tag"
git push origin "$tag"

gh release create "$tag" "$file"
