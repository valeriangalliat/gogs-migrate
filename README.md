# gogs-migrate [![npm version](http://img.shields.io/npm/v/gogs-migrate.svg?style=flat-square)](https://www.npmjs.org/package/gogs-migrate)

> Migrate existing repositories on a [Gogs] instance.

[Gogs]: http://gogs.io/

Overview
--------

[Gogs] is a lightweight self-hosted Git service. There's a neat
GitHub-like interface to show, the repositories, and I find it perfect
to mirror public GitHub repositories on a home server, and have *really*
private repositories (that don't even leave your home, unlike "private"
cloudish solutions). It's also really lightweight, unlike GitLab, and
can easily run with SQLite on tiny computers like a Raspberry PI!

There is a built-in way to migrate external repositories, with a mirror
option so your local copy is always up-to-date. And the interesting
thing is [there's an API][migrate-api] to automate this task.

[migrate-api]: http://gogs.io/docs/features/migrate.html

**gogs-migrate** is a script to automatically migrate (and optionally
mirror) all your repositories from different sources (currently only
GitHub public repositories are supported), to your Gogs instance.

You need to configure your Gogs URL (`--gogs`), access token and UID
(`--gogs-token`, and `--gogs-uid`). If those options are not passed via
CLI, and a [configuration file](#configuration) is given (`--config`),
gogs-migrate will try to read them from the configuration file.
Otherwise, it will prompt for the missing options.

Then, you can configure a source for the repositories to migrate.
Currently, only GitHub is supported, with the `--github-user` option. It
will find only the public repositories, and there's currently no way to
configure credentials to access private repositories. You can migrate
your forks with the `--with-forks` option, but by default gogs-migrate
will ignore them.

On Gogs side, you can pass `--mirror` so the migrated repositories are
flagged as mirrors (Gogs will update them periodically), and `--private`
to make them private.

Installation
------------

### With npm

```sh
npm install -g gogs-migrate
```

### Manually

Clone this repository, then in the directory:

```sh
npm install
```

You can now use `bin/gogs-migrate` (or put `$PWD/bin` in your `PATH`).

<!-- BEGIN USAGE -->

Usage
-----

```
gogs-migrate [options]
```

### Options

Name | Description
---- | -----------
`-h, --help` | Show help.
`-V, --version` | Show version.
`-c, --config=<path>` | Read options from given YAML configuration file.
`--gogs-prefix=<prefix>` | Gogs URL prefix (like `https://git.example.com`).
`--gogs-token=<token>` | Gogs access token (required, prompt otherwise).
`--gogs-uid=<uid>` | Gogs UID (required, prompt otherwise).
`--github-prefix=<prefix>` | GitHub API prefix (defaults to `https://api.github.com`).
`--github-user=<user>` | GitHub username to stream repositories from.
`--github-token=<token>` | GitHub user token to access private repositories.
`--mirror` | Create mirror repositories.
`--private` | Force private repositories (copy source visibility otherwise).
`--with-forks` | Include forked repositories.
`--save` | Save migrated repositories to configuration file to avoid downloading them again the next time.

<!-- END USAGE -->

Configuration
-------------

You can specify a YAML configuration file with the `--config` option.
It can contain all the normal CLI long options, with the leading `--`
removed.

```yaml
gogs: https://git.example.com
gogs-token: foo
gogs-uid: 42
github-user: bar
mirror: true
```

Here, `gogs-pass` is not specified, and if it's not given via CLI, so
you will be prompted for your password (that's the recommended way).
