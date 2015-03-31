var faucet = require('../../lib/faucet').default()
var logger = require('../../lib/logger').logger

function onFulfilled (data) {
  this.jsonp({status: 'success', data: data})
}

function onRejected (err) {
  logger.error('faucet error: ', err)
  this.jsonp({status: 'fail', message: err.message})
}

module.exports.preload = function (req, res) {
  faucet.getUnspents(req.query.type)
    .done(onFulfilled.bind(res), onRejected.bind(res))
}

module.exports.withdrawal = function (req, res) {
  faucet.withdrawal(req.query.toAddress, parseInt(req.query.value, 10))
    .done(onFulfilled.bind(res), onRejected.bind(res))
}
