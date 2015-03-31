var faucet = require('../../lib/faucet').default()
var logger = require('../../lib/logger').logger

// split on two functions: onFulfilled, onRejected...
function commonResponse (promise, res) {
  promise.done(function (data) {
    res.jsonp({status: 'success', data: data})
  }, function (err) {
    logger.error('faucet error: ', err)
    res.jsonp({status: 'fail', message: err.message})
  })
}

module.exports.preload = function (req, res) {
  var promise = faucet.getUnspents(req.query.type)
  commonResponse(promise, res)
}

module.exports.withdrawal = function (req, res) {
  var promise = faucet.withdrawal(req.query.toAddress, parseInt(req.query.value))
  commonResponse(promise, res)
}
