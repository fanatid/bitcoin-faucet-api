module.exports = function (app) {
  var faucet = require('./controllers/faucet')
  app.get('/unspents', faucet.unspents)
  app.get('/withdrawal', faucet.withdrawal)

  var index = require('./controllers/index')
  app.get('/version', index.version)
  app.get('*', index.render)
}
