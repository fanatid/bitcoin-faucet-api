/**
 * Error
 *  +-- FaucetAPI
 *       +-- JSENDError
 *       +-- JSENDFail
 */

let spec = {
  name: 'FaucetAPI',
  message: 'FaucetAPI internal error',
  errors: [{
    name: 'JSENDError',
    message: '${0}'
  }, {
    name: 'JSENDFail',
    message: '{0}'
  }]
}

require('error-system').extend(Error, spec)
module.exports = Error.FaucetAPI
