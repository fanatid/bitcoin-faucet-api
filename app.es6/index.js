import 'source-map-support/register'

import yargs from 'yargs'
import fs from 'fs'
import Yaml from 'js-yaml'
import bitcore from 'bitcore-lib'

export default async function (app) {
  let argv = yargs
    .usage('Usage: $0 [-h] [-c CONFIG]')
    .options('c', {
      alias: 'config',
      describe: 'configuration file',
      default: 'config/default.yml',
      nargs: 1
    })
    .help('h')
    .alias('h', 'help')
    .epilog('https://github.com/fanatid/bitcoin-faucet-api')
    .version(() => require('../package.json').version)
    .argv

  let logger
  try {
    // load config
    let config = require('./config')
    config.update(Yaml.safeLoad(fs.readFileSync(argv.config, 'utf-8')))

    // load logger
    logger = require('./logger')
    let bluebird = require('bluebird')
    if (Promise === bluebird) {
      Promise.onPossiblyUnhandledRejection(function (err) {
        logger.error(err.stack || err.toString())
      })
    }

    // check network
    let networkName = config.get('wallet.network')
    if (bitcore.Networks.get(networkName) === undefined) {
      throw new Error(`Invalid network ${networkName}`)
    }

    // run app
    let Insight = require('./insight')
    let insight = new Insight()

    let Storage = require('./storage')
    let storage = new Storage()
    await storage.ready

    let Wallet = require('./wallet')
    let wallet = new Wallet(storage, insight)
    await wallet.ready

    require('./server')(wallet)
  } catch (err) {
    try {
      logger.error(err.stack)
    } catch (e) {
      console.error(err.stack)
    }

    process.exit(0)
  }
}
