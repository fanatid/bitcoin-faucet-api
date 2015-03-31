var faucet = require('../../lib/faucet').default()
var common = require('./common')

module.exports.preload = function (req, res) {
  faucet.getUnspents(req.query.type)
    .done(common.onFulfilled.bind(res), common.onRejected.bind(res))
}

module.exports.withdrawal = function (req, res) {
  faucet.withdrawal(req.query.toAddress, parseInt(req.query.value, 10))
    .done(common.onFulfilled.bind(res), common.onRejected.bind(res))
}
