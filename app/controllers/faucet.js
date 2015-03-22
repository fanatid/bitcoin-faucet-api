var faucet = require('../../lib/faucet').default()

module.exports.unspents = function (req, res) {
  res.jsonp({unspent: '12e'})
}

module.exports.withdrawal = function (req, res) {
  res.jsonp({txId: 'asd'})
}
