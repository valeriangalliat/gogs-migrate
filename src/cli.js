const _ = require('highland')
const { denodeify, request } = require('./util')

const chalk = require('chalk')
const { docopt } = require('docopt')
const read = denodeify(require('read'))
const readFile = denodeify(require('fs').readFile)
const yaml = require('js-yaml').safeLoad

const migrate = require('./')
const github = require('./github')

const doc = `
Usage:
  gogs-migrate [options]

Options:
  -h, --help            Show help.
  -V, --version         Show version.
  -c, --config=<path>   Read options from given YAML configuration file.
  --gogs=<prefix>       Gogs URL prefix (like \`https://git.example.com\`).
  --gogs-user=<user>    Gogs username (required, prompt otherwise).
  --gogs-pass=<pass>    Gogs password (required, prompt otherwise).
  --gogs-uid=<uid>      Gogs UID (required, prompt otherwise).
  --github=<prefix>     GitHub API prefix (defaults to \`https://api.github.com\`).
  --github-user=<user>  GitHub username to stream repositories from.
  --mirror              Create mirror repositories.
  --private             Force private repositories (copy source visibility otherwise).
  --with-forks          Include forked repositories.
`.trim()

// Set properties on given object from a stream of name/value pairs.
const setProperties = object =>
  _.pipeline(
    _.map(args => _.set(...args)),
    _.reduce(Object.assign({}, object), (opts, set) => set(opts))
  )

// Merge options and configuration file.
const config = opts => !opts['--config']
  ? [opts]
  : readFile(opts['--config'], 'utf8')
      .map(yaml)
      .flatMap(_.pairs)
      .map(([name, value]) => [`--${name}`, value])
      .pipe(setProperties(opts))

// Prompt for option if not defined.
const maybePrompt = opts => ([name, prompt]) =>
  (opts[name] ? _([opts[name]]) : read(prompt))
    .map(value => [name, value])

const greyParens = text =>
  text
    .replace('(', chalk.styles.grey.open + '(')
    .replace(')', ')' + chalk.styles.grey.close)

const ask = question =>
  `${chalk.green('>>')} ${greyParens(question)}${chalk.styles.cyan.open}`

// Prompt for required options if needed.
const prompt = opts =>
  _([
    ['--gogs', { prompt: ask('Gogs URL (example: `https://git.example.com`):') }],
    ['--gogs-user', { prompt: ask('Gogs user:') }],
    ['--gogs-pass', { prompt: ask('Gogs pass (will not echo):'), silent: true }],
    ['--gogs-uid', { prompt: ask('Gogs UID:') }],
  ])
    .flatMap(maybePrompt(opts))
    .pipe(setProperties(opts))

// Parse options, apply configuration file and prompt missing values.
const opts = argv =>
  _([docopt(doc, { argv, version: require('./package').version })])
    .flatMap(config)
    .flatMap(prompt)

// Get repository stream from configured sources.
const repos = opts =>
  _([

    // From GitHub.
    opts['--github-user'] && github.repos({
      user: opts['--github-user'],
      prefix: opts['--github-prefix'] || undefined
    }),

    // Add sources here? Bitbucket, stdin, etc.

  ])
    .compact() // Remove falsy values.
    .sequence() // Merge inner streams.

// From fulfilled options, get repositories and migrate.
const main = opts =>
  repos(opts)
    .filter(opts['--with-forks'] ? repo => true : repo => !repo.fork)

    .flatMap(migrate({
      prefix: opts['--gogs'],
      user: opts['--gogs-user'],
      pass: opts['--gogs-pass'],
      uid: opts['--gogs-uid'],
      mirror: opts['--mirror'],
      private: opts['--private'],
    }))

    .map(({ repo }) => `${chalk.green('>>')} ${repo.name}`)

    .errors((e, push) => {
      if (e.repo) push(undefined, chalk.red(`>> ${e.repo.name} `) + e)
      else push(e)
    })

export default argv =>
  opts(argv)
    .flatMap(main)
    .errors(e => console.error(e.stack || e))
    .each(_.log)
