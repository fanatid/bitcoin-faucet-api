/* globals Promise:true */

var _ = require('lodash')
var io = require('socket.io-client')
var Promise = require('bluebird')
var request = Promise.promisify(require('request'))
var url = require('url')
var urlJoin = require('url-join')
var LRU = require('lru-cache')
var Emitter = require('component-emitter')

var config = require('./config')
var errors = require('./errors')
var logger = require('./logger').logger

/**
 * @event Provider#connect
 */

/**
 * @event Provider#touchAddress
 * @param {string} address
 * @param {string} txId
 */

/**
 * @class Provider
 * @mixes Emitter
 */
function Provider () {
  if (config.get('provider.name') !== 'insight') {
    throw new errors.UnknowProvider(config.get('provider.name'))
  }

  var self = this
  self._insightURL = config.get('provider.insight.url')
  self._reqTimeout = config.get('provider.insight.timeout')
  self._subscribed = []
  self._txCache = LRU({max: 25})

  var urldata = url.parse(self._insightURL)
  var ioURL = (urldata.protocol === 'http:' ? 'ws://' : 'wss://') + urldata.host
  self._socket = io(ioURL, {
    autoConnect: true,
    forceNew: true,
    reconnectionDelay: 10000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0
  })

  self._socket.on('connect', function () {
    logger.info('connect to insight server')
    _.forEach(self._subscribed, function (address) {
      self._socket.emit('subscribe', address)
    })
    self.emit('connect')
  })

  self._socket.on('connect_error', function (err) {
    logger.error('insight connection error: %s', err)
  })

  self._socket.on('connect_timeout', function () {
    logger.error('insight connection timeout')
  })

  self._socket.on('disconnect', function () {
    logger.info('disconnect from insight server')
  })
}

Emitter(Provider.prototype)

/**
 * @return {boolean}
 */
Provider.prototype.isConnected = function () {
  return this._socket.connected
}

/**
 * @param {string} address
 */
Provider.prototype.subscribe = function (address) {
  var self = this
  if (self._subscribed.indexOf(address) !== -1) {
    return
  }

  self._subscribed.push(address)
  self._socket.on(address, function (txId) {
    self.emit('touchAddress', address, txId)
  })

  if (self._socket.connected) {
    self._socket.emit('subscribe', address)
  }
}

/**
 * @param {string} address
 * @return {Promise<Array.<string>>}
 */
Provider.prototype.getUnspents = function (address) {
  return request({
    method: 'GET',
    uri: urlJoin(this._insightURL, 'addr', address, 'utxo'),
    timeout: this._reqTimeout,
    json: true,
    zip: true
  })
  .spread(function (response, body) {
    return body.map(function (item) {
      return {txid: item.txid, vout: item.vout}
    })
  })
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
Provider.prototype.getTx = function (txId) {
  var self = this
  if (self._txCache.has(txId)) {
    return Promise.resolve(self._txCache.get(txId))
  }

  return request({
    method: 'GET',
    uri: urlJoin(self._insightURL, 'tx', txId, 'hex'),
    timeout: self._reqTimeout,
    json: true,
    zip: true
  })
  .spread(function (response, body) {
    self._txCache.set(txId, body.hex)
    return body.hex
  })
}

/**
 * @param {string} rawTx
 * @return {Promise}
 */
Provider.prototype.sendTx = function (rawTx) {
  return request({
    method: 'POST',
    uri: urlJoin(this._insightURL, 'tx/send'),
    timeout: this._reqTimeout,
    json: {rawtx: rawTx},
    zip: true
  })
  .then(function () {})
}

module.exports = require('soop')(Provider)
