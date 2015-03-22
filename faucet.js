#!/usr/bin/env node
/* globals Promise:true */

var fs = require('fs')
var path = require('path')

var _ = require('lodash')
var http = require('http')
var https = require('https')
var express = require('express')
var Promise = require('bluebird')
var yargs = require('yargs')

var argv = yargs
  .usage('Usage: $0 [-h] [-c CONFIG]')
  .options('c', {
    alias: 'config',
    describe: 'configuration file',
    default: 'config/default.yml',
    nargs: 1
  })
  .help('h')
  .alias('h', 'help')
  .epilog('https://github.com/fanatid/bitcoin-faucet')
  .version(function () { return require('./package.json').version })
  .argv

// load config
var config = require('./lib/config').load(argv.config)

// logging unhadled errors
var logger = require('./lib/logger').logger
Promise.onPossiblyUnhandledRejection(function (err) {
  logger.error(err.stack || err.toString())
})

// create express app
var expressApp = express()

// create server
var server = (function () {
  if (config.get('server.enableHTTPS') === false) {
    return http.createServer(expressApp)
  }

  var opts = {}
  opts.key = fs.readFileSync('./etc/faucet-key.pem')
  opts.cert = fs.readFileSync('./etc/faucet-cert.pem')
  return https.createServer(opts, expressApp)
})()

// express settings
require('./app/express')(expressApp)
require('./app/routes')(expressApp)

// start the app by listening port
server.listen(config.get('server.port'), function () {
  logger.info('faucet server listening the port %s', config.get('server.port'))
})
