const { request } = require('./util')

const err = (repo, message) =>
  Object.assign(new Error(message), { repo })

const migrate = '/api/v1/repos/migrate'

// Migrate repository to Gogs.
export default opts => repo =>
  request(`${opts.prefix}${migrate}`, {
    method: 'post',
    json: true,
    form: Object.assign(
      { username: opts.user, password: opts.pass, uid: opts.uid },

      {
        clone_addr: repo.url,
        repo_name: repo.name,
        desc: repo.desc,
      },

      repo.private && { private: 'on' },

      opts.auth && {
        auth_username: opts.auth.user,
        auth_password: opts.auth.pass,
      },

      opts.mirror && { mirror: 'on' },
      opts.private && { private: 'on' },

      {}
    ),
  })
    .doto(response => {
      if (response.statusCode === 500) return // 500 errors have a JSON message.
      if (response.statusCode === 200) return // JSON response.
      throw err(repo, `Unexpected status ${response.statusCode} from ${opts.prefix}${migrate}`)
    })

    .map(response => Object.assign({ repo }, response.body))

    .doto(({ message }) => {
      if (message) throw err(repo, message)
    })
