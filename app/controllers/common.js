var logger = require('../../lib/logger').logger

module.exports.onFulfilled = function (data) {
  this.jsonp({status: 'success', data: data})
}

module.exports.onRejected = function (err) {
  logger.error('faucet error: ', err)
  this.jsonp({status: 'fail', message: err.message})
}
