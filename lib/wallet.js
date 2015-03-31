/* globals Promise:true */

var _ = require('lodash')
var Promise = require('bluebird')
var bitcore = require('bitcore')
var Mnemonic = require('bitcore-mnemonic')
var timers = require('timers')

var config = require('./config')
var errors = require('./errors')
var logger = require('./logger').logger
var util = require('./util')

var provider = require('./provider').default()
// var storage = require('./storage').default()

/**
 * @class Wallet
 */
function Wallet () {
  var self = this
  self.unspents = []
  self._cachedBalance = null

  self.network = bitcore.Networks.get(config.get('wallet.network'))
  if (self.network === undefined) {
    throw new errors.Wallet.InvalidNetwork(config.get('wallet.network'))
  }

  // generate addresses
  self._generateAddressPool()

  // subscribe on new tx
  _.each(self.addresses, function (privKey, address) {
    provider.subscribe(address)
  })
  provider.on('touchAddress', function (address, txId) { self._scanTxId(txId) })

  // run force update on connect and in interval
  provider.on('connect', self._forceUnspentUpdate.bind(self))
  if (provider.isConnected()) {
    self._forceUnspentUpdate()
  }

  var interval = config.get('wallet.forceUnspentUpdate') * 1000
  setInterval(self._forceUnspentUpdate.bind(self), interval)
}

/**
 */
Wallet.prototype._generateAddressPool = function () {
  var self = this
  if (!Mnemonic.isValid(config.get('wallet.mnemonic'))) {
    throw new errors.Wallet.InvalidMnemonic(config.get('wallet.mnemonic'))
  }

  var data = config.get('wallet.mnemonic')
  var passphrase = config.get('wallet.passphrase')
  var rootPrivKey = Mnemonic(data).toHDPrivateKey(passphrase, self.network)
  var chainPrivKey = rootPrivKey.derive('m/0/0')

  self.addresses = _.chain(0)
    .range(config.get('wallet.addressesPoolSize'))
    .map(function (index) {
      var hdPrivKey = chainPrivKey.derive(index)
      var address = hdPrivKey.publicKey.toAddress(self.network)
      logger.verbose('add address: %s', address.toString())
      return [address.toString(), hdPrivKey.privateKey]
    })
    .zipObject()
    .value()
}

/**
 */
Wallet.prototype._forceUnspentUpdate = function () {
  var self = this

  function scanUnspents (unspents) {
    _.each(unspents, function (unspent) {
      self._scanTxId(unspent.txId, unspent.vout)
    })
  }

  _.each(self.addresses, function (privKey, address) {
    provider.getUnspents(address).then(scanUnspents)
  })
}

/**
 * @param {string} txId
 * @param {number} vout
 * @return {Promise}
 */
Wallet.prototype._scanTxId = function (txId, vout) {
  var self = this
  return provider.getTx(txId)
    .then(function (rawTx) {
      var tx = new bitcore.Transaction(rawTx)
      return self._scanTx(tx, vout)
    })
}

/**
 * @param {bitcore.Transaction} tx
 * @param {number} vout
 * @return {Promise}
 */
Wallet.prototype._scanTx = util.makeSerial(function (tx, vout) {
  logger.verbose('scan tx %s', tx.id)

  var self = this
  return Promise.try(function () {
    tx.outputs.forEach(function (output, outputIndex) {
      // skip if we have special vout and outputIndex not match
      if (vout !== undefined && vout !== outputIndex) {
        return
      }

      // try load script
      try { output.script } catch (e) { return }

      // is my coin?
      var address = output.script.toAddress(self.network).toString()
      if (self.addresses[address] === undefined) {
        return
      }

      // split coin if they more than 0.02 btc
      if (output.satoshis > 2000000) {
        return timers.setImmediate(
          self._splitOnPieces.bind(self), tx.id, outputIndex)
      }

      // unspent object
      var unspent = {
        address: address,
        txId: tx.id,
        vout: outputIndex,
        value: output.satoshis
      }

      // unspent already exists?
      if (_.find(self.unspents, unspent) !== undefined) {
        return
      }

      // save unspent
      var startIndex = _.sortedIndex(self.unspents, unspent, 'value')
      self.unspents.splice(startIndex, 0, unspent)

      // drop cached balance and show message in log
      self._cachedBalance = null
      logger.info('find unspent for %s (+%s btc, total: %s btc)',
                  unspent.address,
                  bitcore.Unit.fromSatoshis(unspent.value).toBTC(),
                  bitcore.Unit.fromSatoshis(self.getBalance()).toBTC())
    })
  })
})

/**
 * @param {string} txId
 * @param {number} vout
 */
Wallet.prototype._splitOnPieces = function (txId, vout) {
  logger.info('split unspent %s:%d', txId, vout)
  /* @todo */
}

/**
 * @return {number}
 */
Wallet.prototype.getBalance = function () {
  if (this._cachedBalance === null) {
    this._cachedBalance = _.sum(_.pluck(this.unspents, 'value'))
  }

  return this._cachedBalance
}

/**
 * @return {string}
 */
Wallet.prototype.getRandomAddress = function () {
  var addresses = _.keys(this.addresses)
  return addresses[_.random(addresses.length - 1)]
}

/**
 * @typedef Wallet~RecipientObject
 * @property {string} address
 * @property {number} value in satoshi
 */

/**
 * @param {Array.<Wallet~RecipientObject>} recipients
 * @return {Promise<string>}
 */
// makeSerial easier than coin freeze
Wallet.prototype.sendTo = util.makeSerial(function (recipients) {
  var self = this
  return Promise.try(function () {
    var tx = bitcore.Transaction()

    _.each(recipients, function (recipient) {
      tx = tx.to(recipient.address, recipient.value)
    })

    tx = tx.change(self.getRandomAddress())

    var totalValue = tx.outputAmount + tx.getFee()
    var value = self.unspents.reduce(function (obj, unspent) {
      if (obj.total < totalValue) {
        obj.total += unspent.value
        obj.unspents.push(unspent)
      }

      return obj
    }, {total: 0, unspents: []})

    if (value.total < totalValue) {
      throw new errors.Wallet.InsufficientFunds(totalValue, value.total)
    }

    _.each(value.unspents, function (unspent) {
      tx = tx.from({
        txId: unspent.txId,
        outputIndex: unspent.vout,
        script: bitcore.Script.buildPublicKeyHashOut(unspent.address),
        satoshis: unspent.value
      })
    })

    var privKeys = _.chain(value.unspents)
      .pluck('address')
      .uniq()
      .map(function (address) { return self.addresses[address] })
      .value()

    tx = tx.sign(privKeys)

    return provider.sendTx(tx.serialize())
      .then(function () {
        var diff = value.total - tx.getChangeOutput().satoshis
        logger.info('spent %s btc in transaction %s',
                    bitcore.Unit.fromSatoshis(diff).toBTC(),
                    tx.id)

        self.unspents = self.unspents.filter(function (unspent) {
          return _.find(value.unspents, unspent) === undefined
        })
      })
  })
})

module.exports = require('soop')(Wallet)
