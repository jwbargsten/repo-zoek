# repo-zoek

List, download and index github repos for trigram-based search on your machine using
[zoekt](https://github.com/sourcegraph/zoekt).

## Installation

```sh
go install github.com/google/zoekt/cmd/zoekt-index
go install github.com/google/zoekt/cmd/zoekt

npm install --global jwbargsten/repo-zoek
```

## Usage

You need a github personal access token and it needs to be accessible in the environment
as `GITHUB_PAT` when running `repo-zoek`.

Help:

```sh
repo-zoek help
```

Initial setup of a new "project":

```sh
repo-zoek org list
repo-zoek init
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
