function getVersion () {
  return require('../../package.json').version
}

module.exports.render = function (req, res) {
  res.send('faucet API v' + getVersion())
}

module.exports.status = function (req, res) {
  /* @todo */
  res.jsonp({})
}

module.exports.version = function (req, res) {
  res.jsonp({version: getVersion()})
}
