const _ = require('highland')
const promisify = require('es6-denodeify')(Promise)

export const denodeify = f => (...args) => _(promisify(f)(...args))
export const request = denodeify(require('request'))
