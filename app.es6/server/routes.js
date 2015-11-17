import express from 'express'

import controllers from './controllers'

export default function createRoutes (app) {
  let router = express.Router()

  router.get('/preload', controllers.preload)
  router.get('/withdrawal', controllers.withdrawal)
  router.get('/donation', controllers.donation)
  router.get('/status', controllers.status)
  router.get('/version', controllers.version)

  return router
}
