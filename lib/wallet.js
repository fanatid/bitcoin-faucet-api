/* globals Promise:true */

var inherits = require('util').inherits
var EventEmitter = require('events').EventEmitter
var timers = require('timers')

var _ = require('lodash')
var Promise = require('bluebird')
var bitcore = require('bitcore')
var Mnemonic = require('bitcore-mnemonic')

var config = require('./config')
var errors = require('./errors')
var provider = require('./provider')
var logger = require('./logger').logger

/**
 * @typedef Wallet~UnspentObject
 * @property {string} address
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 */

/**
 * @event Wallet#ready
 */

/**
 * @event Wallet#error
 * @param {Error} error
 */

/**
 * @class Wallet
 * @extends EventEmitter
 * @param {Storage} storage
 */
function Wallet (storage) {
  var self = this
  EventEmitter.call(self)

  self._isReady = false
  self._cachedBalance = null

  self.storage = storage

  var storageReadyPromise = new Promise(function (resolve) {
    if (self.storage.isReady()) { return resolve() }
    self.storage.once('ready', resolve)
  })
  storageReadyPromise
    .then(function () {
      return self.storage.loadWalletUnspents()
    })
    .then(function (unspents) {
      self.unspents = unspents

      self.network = bitcore.Networks.get(config.get('wallet.network'))
      if (self.network === undefined) {
        throw new errors.Wallet.InvalidNetwork(config.get('wallet.network'))
      }

      if (!Mnemonic.isValid(config.get('wallet.mnemonic'))) {
        throw new errors.Wallet.InvalidMnemonic(config.get('wallet.mnemonic'))
      }

      var code = Mnemonic(config.get('wallet.mnemonic'))
      var seed = code.toSeed(config.get('wallet.passphrase'))
      var rootPrivKey = bitcore.HDPrivateKey.fromSeed(seed, self.network)
      var chainPrivKey = rootPrivKey.derive('m/0/0')

      self.addresses = _.chain(0)
        .range(config.get('wallet.addressesPoolSize'))
        .map(function (index) {
          var privKey = chainPrivKey.derive(index)
          var address = new bitcore.Address(privKey.publicKey, self.network)
          logger.verbose('add address: %s', address.toString())
          return [address.toString(), privKey]
        })
        .zipObject()
        .value()

      timers.setImmediate(self._scanAddresses.bind(self))
    })
    .then(function () { self._isReady = true })
}

inherits(Wallet, EventEmitter)

/**
 */
Wallet.prototype._scanAddresses = function () {
  var self = this
  logger.verbose('run Wallet._scanAddresses')

  Promise.all(Object.keys(self.addresses).map(function (address) {
    return provider.addresses.unspentsAsync(address)
      .then(function (unspents) {
        return unspents.map(function (unspent) {
          return {
            address: address,
            txId: unspent.txId,
            outIndex: unspent.vout,
            value: unspent.value
          }
        })
      })
  }))
  .then(function (unspents) {
    return _.flatten(unspents).reduce(function (promise, unspent) {
      if (_.find(self.unspents, unspent) !== undefined) {
        return promise
      }

      return promise
        .then(function () {
          return self.storage.insertWalletUnspent(unspent)
        })
        .then(function () {
          self.unspents.push(unspent)
          self._cachedBalance = null
          logger.verbose('add new unspent for %s (+%s btc)',
                         unspent.address,
                         bitcore.Unit.fromSatoshis(unspent.value).toBTC())
        })
    }, Promise.resolve())
  })
  .catch(function (err) { self.emit('error', err) })
  .then(function () {
    var delay = config.get('wallet.refreshInterval') * 1000
    setTimeout(self._scanAddresses.bind(self), delay)
  })
}

/**
 * @return {boolean}
 */
Wallet.prototype.isReady = function () { return this._isReady }

/**
 * @return {number}
 */
Wallet.prototype.getBalance = function () {
  if (this._cachedBalance === null) {
    this._cachedBalance = this.unspents.reduce(function (sum, unspent) {
      return sum + unspent.value
    }, 0)
  }

  return this._cachedBalance
}

module.exports = Wallet
