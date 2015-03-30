/* globals Promise:true */

var _ = require('lodash')
var io = require('socket.io-client')
var Promise = require('bluebird')
var request = Promise.promisify(require('request'))
var url = require('url')
var urlJoin = require('url-join')
var LRU = require('lru-cache')

var config = require('./config')
var errors = require('./errors')
var logger = require('./logger').logger

/**
 * @class Provider
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
  self.socket = io(ioURL, {
    autoConnect: true,
    forceNew: true,
    reconnectionDelay: 10000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0
  })

  self.socket.on('connect', function () {
    logger.info('connect to insight server')
    _.forEach(self._subscribed, function (address) {
      self.socket.emit('subscribe', address)
    })
  })

  self.socket.on('connect_error', function (err) {
    logger.error('insight connection error: %s', err)
  })

  self.socket.on('connect_timeout', function () {
    logger.error('insight connection timeout')
  })

  self.socket.on('disconnect', function () {
    logger.info('disconnect from insight server')
  })
}

/**
 * @callback Provider~subscribeCallback
 * @param {string} txId
 */

/**
 * @param {string} address
 * @param {Provider~subscribeCallback} callback
 */
Provider.prototype.subscribe = function (address, callback) {
  if (this._subscribed.indexOf(address) !== -1) {
    return
  }

  this._subscribed.push(address)
  this.socket.on(address, callback)

  if (this.socket.connected) {
    this.socket.emit('subscribe', address)
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
  if (this._txCache.has(txId)) {
    return Promise.resolve(this._txCache.get(txId))
  }

  return request({
    method: 'GET',
    uri: urlJoin(this._insightURL, 'tx', txId, 'hex'),
    timeout: this._reqTimeout,
    json: true,
    zip: true
  })
  .spread(function (response, body) {
    this._txCache.set(txId, body.hex)
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
