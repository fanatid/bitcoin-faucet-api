import express from 'express'
import expressWinston from 'express-winston'
import methodOverride from 'method-override'
import bodyParser from 'body-parser'
import compression from 'compression'

import errors from '../errors'
import logger from '../logger'

express.response.jsend = function (data) {
  this.jsonp({status: 'success', data: data})
}

express.response.jfail = function (data) {
  this.jsonp({status: 'fail', data: data})
}

express.response.jerror = function (message) {
  this.jsonp({status: 'error', message: message})
}

express.response.promise = async function (promise) {
  try {
    let result = await promise
    this.jsend(result)
  } catch (err) {
    logger.error(err.stack)

    let fn = err instanceof errors.JSENDFail ? ::this.jfail : ::this.jerror
    fn(err.message)
  }
}

export default function getExpressApp () {
  let app = express()

  app.set('showStackError', true)
  app.set('etag', false)

  app.enable('jsonp callback')

  app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization')
    res.setHeader('Access-Control-Expose-Headers', 'X-Email-Needs-Validation,X-Quota-Per-Item,X-Quota-Items-Limit,X-RateLimit-Limit,X-RateLimit-Remaining')
    next()
  })

  app.use(expressWinston.logger({
    winstonInstance: logger,
    meta: false,
    expressFormat: true,
    colorStatus: true
  }))
  app.use(methodOverride())
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(compression())

  return app
}
