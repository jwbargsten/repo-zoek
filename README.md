# repo-zoek

List, download and index github repos for trigram-based search on your machine using
[zoekt](https://github.com/sourcegraph/zoekt).

## Preparation

* Install node >= 12
* You need to have [golang](https://go.dev/doc/install) installed
* You need a [github personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) and it needs to be accessible in the environment as `GITHUB_PAT` when running

`repo-zoek`.
## Installation

```sh
go install github.com/google/zoekt/cmd/zoekt-index@latest
go install github.com/google/zoekt/cmd/zoekt@latest

# make sure npm does not try to install the script to /usr/local/bin or similar
npm config set prefix ~/.npm-pkg
# (TAKE CARE: if you use nvm or similar, 
#  make sure that your prefix setting does 
#  not interfere with nvm. In case of nvm, you
#  can probably skip it.)

# install repo-zoek
npm install --global <https://link-to-latest-release.tgz>
# (SEE BELOW for the releases page)
```
([see release page for newest version](https://github.com/jwbargsten/repo-zoek/releases/latest))

make sure the go & npm bin path is in your `$PATH`. You can get the path with

```sh
# $GOPATH/bin
go env GOPATH
# npm bin dir
npm bin --global
```

Example:

```bash
export PATH="$(go env GOPATH)/bin:$(npm bin -g):$PATH"
```

## Usage

You need a
[github personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
and it needs to be accessible in the environment as `GITHUB_PAT` when running
`repo-zoek`.

Help:

```sh
repo-zoek help
```

Initial setup of a new "project":

```sh
repo-zoek init
repo-zoek org list -d /path/to/project/dir
```

To download everything:

```sh
repo-zoek sync all
```

Search with

```sh
zoekt -r -index_dir path/to/search/index 'regex file:scala'
```

(I would alias `zoekt -r -index_dir path/to/search/index` to a more convenient command)


## TODO

* look for `.repo-zoek.json` in the current path
* handle `GITHUB_PAT` better?
