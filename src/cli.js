const _ = require('highland')
const { denodeify, request } = require('./util')

const chalk = require('chalk')
const { docopt } = require('docopt')
const read = denodeify(require('read'))
const readFile = denodeify(require('fs').readFile)
const writeFile = denodeify(require('fs').writeFile)
const yaml = require('js-yaml')
const yamlUpdate = require('yaml-update').edit
const zipObject = require('lodash.zipobject')

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
  --save                Save migrated repositories to configuration file to avoid
                        downloading them again the next time.
`.trim()

// Edit YAML in place (wrapper to avoid passing JSON).
const yamlEdit = (source, data) =>
  yamlUpdate(source, JSON.stringify(data))

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
      // Keep original source and object for further usage.
      .map(source => [source, yaml.safeLoad(source)])
      .map(([source, data]) => Object.assign({}, data, {
        'config-source': source,
        'config-object': data,
      }))

      // Convert to options and extend `opts`.
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
  `${chalk.blue('>>')} ${greyParens(question)}${chalk.styles.cyan.open}`

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

    // Make sure `--ignore` is a hash.
    .map(opts => Object.assign({}, opts, {
      '--ignore': zipObject(opts['--ignore']),
    }))

// Get repository stream from configured sources.
const repos = opts =>
  _([

    // From GitHub.
    opts['--github-user'] && github.repos({
      user: opts['--github-user'],
      prefix: opts['--github-prefix'] || undefined,
    }),

    // Add sources here? Bitbucket, stdin, etc.

  ])
    .compact() // Remove falsy values.
    .sequence() // Merge inner streams.

    // Apply filters.
    .filter(opts['--with-forks'] ? repo => true : repo => !repo.fork)
    .filter(repo => !(repo.name in opts['--ignore']))

// UI for regular migration stream.
const migrateStream = repoStream =>
  repoStream.fork()
    .map(({ repo }) => `${chalk.green('>>')} ${repo.name}`)

    .errors((e, push) => {
      if (e.repo) push(undefined, chalk.red(`>> ${e.repo.name} `) + e)
      else push(e)
    })

const saveConfig = (opts, repos) =>
  [[opts['--config'], yamlEdit(
    opts['--config-source'],
    Object.assign(opts['--config-object'], {
      ignore: (Object.keys(opts['--ignore'] || {})).concat(repos),
    })
  )]]

const saveNew = repos =>
  _(read({
    prompt: ask('Where to save migrated repos (file will be overwritten)?'),
  }))
    .map(file => [file, yaml.safeDump({ ignore: repos })])

// Save migrated repositories in configuration file at the end.
const saveStream = (opts, repoStream) =>
  repoStream.fork()
    .map(({ repo }) => repo.name)
    .reduce([], (memo, repo) => memo.concat([repo]))

    // Do nothing if there was no repositories.
    .filter(repos => repos.length)

    // Append migrated repositories to ignore list.
    .flatMap(repos => opts['--config']
      ? saveConfig(opts, repos)
      : saveNew(repos)
    )

    .flatMap(([file, yaml]) => writeFile(file, yaml))
    .map(() => `${chalk.blue('>>')} Configuration written!`)

    // Ignore repository errors (already handled).
    .errors((e, push) => {
      if (!e.repo) push(e)
    })

// From fulfilled options, get repositories and migrate.
const main = opts => {
  const repoStream = repos(opts)
    .flatMap(migrate({
      prefix: opts['--gogs'],
      user: opts['--gogs-user'],
      pass: opts['--gogs-pass'],
      uid: opts['--gogs-uid'],
      mirror: opts['--mirror'],
      private: opts['--private'],
    }))

  const stream = migrateStream(repoStream)

  return opts['--save']
    ? _([stream, saveStream(opts, repoStream)]).merge()
    : stream
}

export default argv =>
  opts(argv)
    .flatMap(main)
    .errors(e => console.error(e.stack || e))
    .each(_.log)
