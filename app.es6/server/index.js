import http from 'http'

import config from '../config'
import logger from '../logger'

import getExpressApp from './express'
import createRoutes from './routes'

export default function (wallet) {
  let expressApp = getExpressApp()

  expressApp.all('*', (req, res, next) => {
    req.wallet = wallet
    next()
  })
  expressApp.use(config.get('server.prefix'), createRoutes())
  expressApp.use((req, res) => {
    res.jfail('The endpoint you are looking for does not exist!')
  })

  let server = http.createServer(expressApp)
  server.listen(config.get('server.port'), () => {
    logger.info(`Faucet server listening the port ${config.get('server.port')}`)
  })
}
