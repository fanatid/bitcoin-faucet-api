/* globals Promise:true */

var timers = require('timers')

var _ = require('lodash')
var Promise = require('bluebird')
var bitcore = require('bitcore')
var Mnemonic = require('bitcore-mnemonic')

var config = require('./config')
var errors = require('./errors')
var logger = require('./logger').logger

var provider = require('./provider').default()
var storage = require('./storage').default()

/**
 * @typedef Wallet~UnspentObject
 * @property {string} address
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 */

/**
 * @typedef Wallet~RecipientObject
 * @property {string} script
 * @property {number} value
 */

/**
 * @class Wallet
 */
function Wallet () {
  var self = this
  self._cachedBalance = null

  storage.loadWalletUnspents()
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
}

/**
 */
Wallet.prototype._scanAddresses = function () {
  var self = this
  logger.verbose('run Wallet._scanAddresses')

  Promise.all(Object.keys(self.addresses).map(function (address) {
    return provider.getUnspents(address)
  }))
  .then(function (unspents) {
    return _.flatten(unspents).reduce(function (promise, unspent) {
      if (_.find(self.unspents, unspent) !== undefined) {
        return promise
      }

      return promise
        .then(function () {
          return storage.insertWalletUnspent(unspent)
        })
        .then(function () {
          self.unspents.push(unspent)
          self._cachedBalance = null
          logger.info('add new unspent for %s (+%s btc)',
                      unspent.address,
                      bitcore.Unit.fromSatoshis(unspent.value).toBTC())
        })
    }, Promise.resolve())
  })
  .finally(function () {
    var delay = config.get('wallet.refreshInterval') * 1000
    setTimeout(self._scanAddresses.bind(self), delay)
  })
}

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

/**
 * @param {Array.<Wallet~RecipientObject>} recipients
 * @return {Promise<string>}
 */
Wallet.prototype.sendTo = function (recipients) {

}

module.exports = require('soop')(Wallet)
