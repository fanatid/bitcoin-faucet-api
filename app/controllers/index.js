var common = require('./common')
var wallet = require('../../lib/wallet').default()
var getVersion = require('../../lib/version').getVersion

module.exports.donation = function (req, res) {
  common.onFulfilled.call(res, {address: wallet.getRandomAddress()})
}

module.exports.status = function (req, res) {
  wallet.getStatus()
    .done(common.onFulfilled.bind(res), common.onRejected.bind(res))
}

module.exports.version = function (req, res) {
  common.onFulfilled.call(res, {version: getVersion()})
}

module.exports.render = function (req, res) {
  res.send('faucet API v' + getVersion())
}
