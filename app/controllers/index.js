function getVersion () {
  return require('../../package.json').version
}

module.exports.render = function (req, res) {
  res.send('API v' + getVersion())
}

module.exports.version = function (req, res) {
  res.jsonp({version: getVersion()})
}
