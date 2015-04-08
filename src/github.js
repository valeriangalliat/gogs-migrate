const { request } = require('./util')
const link = require('parse-link-header')

// Get raw API pages.
const pages = opts =>
  request(opts)
    .flatMap(response => {
      // Default to single space to force `link` to return an object.
      // Empty string or `null` would result in `null`.
      const next = link(response.headers.link || ' ').next

      return [response].concat(
        !next ? [] : pages(Object.assign({}, opts, { url: next.url }))
      )
    })

// Get raw API GitHub user repositories.
export const rawRepos =
  ({ user, prefix = 'https://api.github.com', agent = 'gogs-migrate' }) =>
    pages({
      url: `${prefix}/users/${user}/repos`,
      headers: { 'user-agent': agent },
      json: true,
    })
      .flatten()
      .flatMap(response => response.body)

// Extract Gogs formatted data from a repository.
export const parse = repo =>
  ({
    url: repo.clone_url,
    name: repo.name,
    desc: repo.description,
    fork: repo.fork,
    private: repo.private,
  })

// Get repositories in Gogs format.
export const repos = opts =>
  rawRepos(opts).map(parse)
