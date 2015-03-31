module.exports = function (app) {
  var faucet = require('./controllers/faucet')
  app.get('/preload', faucet.preload)
  app.get('/withdrawal', faucet.withdrawal)

  var index = require('./controllers/index')
  app.get('/donation', index.donation)
  app.get('/status', index.status)
  app.get('/version', index.version)
  app.get('*', index.render)
}
