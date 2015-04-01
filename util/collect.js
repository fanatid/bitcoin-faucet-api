#!/usr/bin/env node
/* globals Promise:true */

var _ = require('lodash')
var bitcore = require('bitcore')
var Promise = require('bluebird')
var yargs = require('yargs')

var argv = yargs
  .usage('Usage: $0 [-h] [-c CONFIG] -a ADDRESS')
  .options('c', {
    alias: 'config',
    describe: 'configuration file',
    default: 'config/default.yml',
    nargs: 1
  })
  .options('a', {
    alias: 'address',
    describe: 'address for collect bitcoins',
    nargs: 1,
    required: true
  })
  .help('h')
  .alias('h', 'help')
  .epilog('https://github.com/fanatid/bitcoin-faucet')
  .version(function () { return require('./package.json').version })
  .argv

// load config
var config = require('../lib/config').load(argv.config)

// logging unhadled errors
var logger = require('../lib/logger').logger
Promise.onPossiblyUnhandledRejection(function (err) {
  logger.error(err.stack || err.toString())
})

// import provider, storage and wallet
var provider = require('../lib/provider').default()
var storage = require('../lib/storage').default()
var wallet = require('../lib/wallet').default()
wallet.collectMode = true

// wait some time for unspents
Promise.delay(20 * 1000)
  .then(function () {
    // get preloads
    return Promise.map(config.get('faucet.unspents.types'), function (utype) {
      return storage.getPreloadCount(utype.name).then(function (count) {
        return Promise.reduce(_.range(count), function (total) {
          return storage.getRandomPreload(utype.name).then(function (preload) {
            total.push(preload)
            return total
          })
        }, [])
      })
    })
  })
  .then(function (preloads) {
    preloads = _.flattenDeep(preloads)

    // create new tx
    var tx = bitcore.Transaction()

    // add unspents
    _.each(wallet.unspents, function (unspent) {
      tx.from({
        txId: unspent.txId,
        outputIndex: unspent.vout,
        script: bitcore.Script.buildPublicKeyHashOut(unspent.address),
        satoshis: unspent.value
      })
    })

    // add from preload
    _.each(preloads, function (preload) {
      _.each(preload.unspents, function (unspent) {
        tx.from({
          txId: unspent.txId,
          outputIndex: unspent.vout,
          script: bitcore.Script.buildPublicKeyHashOut(preload.address),
          satoshis: unspent.value
        })
      })
    })

    // set change address
    tx.change(argv.address)

    // sign
    var privKeys = _.chain(preloads)
      .pluck('privateKeyWIF')
      .map(function (wifKey) { return bitcore.PrivateKey.fromWIF(wifKey) })
      .value()
      .concat(_.values(wallet.addresses))

    // sign
    tx.sign(privKeys)

    // send tx ...
    return provider.sendTx(tx.serialize())
  })
  .finally(function () {
    Promise.delay(1000).then(function () { process.exit() })
  })
