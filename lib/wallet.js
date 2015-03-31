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

      // split coin if they more than 0.05 btc
      if (output.satoshis > 5000000) {
        return timers.setImmediate(
          self._splitOnPieces.bind(self), tx, outputIndex)
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
 * @param {bitcore.Transaction} tx
 * @param {number} vout
 */
Wallet.prototype._splitOnPieces = function (tx, vout) {
  logger.info('split unspent %s:%d', tx.id, vout)

  var self = this
  return Promise.try(function () {
    // get unspent address
    var address = tx.outputs[vout].script.toAddress(self.network)

    // create tx
    var newTx = new bitcore.Transaction()
      .from({
        txId: tx.id,
        outputIndex: vout,
        script: bitcore.Script.buildPublicKeyHashOut(address),
        satoshis: tx.outputs[vout].satoshis
      })

    // add output while unspent value more than 0.05 btc
    while (newTx.inputAmount - newTx.outputAmount > 5000000) {
      // create output from 0.02 btc to 0.03 btc
      newTx.to(self.getRandomAddress(), _.random(2000000, 3000000))
    }

    // set change
    newTx.change(self.getRandomAddress())

    // sign
    newTx.sign(self.addresses[address])

    // serialize, send and scan
    return provider.sendTx(newTx.serialize())
      .then(function () { return self._scanTx(newTx) })
  })
}

/**
 * @param {number} requiredValue
 * @return {Object[]}
 * @throws {errors.Wallet.InsufficientFunds}
 */
Wallet.prototype._selectUnspent = function (requiredValue) {
  var unspents = []
  var totalValue = 0

  _.any(this.unspents, function (unspent) {
    unspents.push(unspent)
    totalValue += unspent.value
    return totalValue >= requiredValue
  })

  if (totalValue < requiredValue) {
    throw new errors.Wallet.InsufficientFunds(requiredValue, totalValue)
  }

  return unspents
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
    // create new tx
    var tx = bitcore.Transaction()

    // select unspents and add to transaction
    var unspents = self._selectUnspent(_.sum(recipients, 'value') + 10000)
    _.each(unspents, function (unspent) {
      tx.from({
        txId: unspent.txId,
        outputIndex: unspent.vout,
        script: bitcore.Script.buildPublicKeyHashOut(unspent.address),
        satoshis: unspent.value
      })
    })

    // add all recipients
    _.each(recipients, function (recipient) {
      tx.to(recipient.address, recipient.value)
    })

    // set address for change
    tx.change(self.getRandomAddress())

    // get required private keys for transaction signing
    var privKeys = _.chain(unspents)
      .pluck('address')
      .uniq()
      .map(function (address) { return self.addresses[address] })
      .value()

    // sign transaction
    tx.sign(privKeys)

    // serialize and send
    return provider.sendTx(tx.serialize())
      .then(function () {
        // show message
        var diff = tx.inputAmount - tx.getChangeOutput().satoshis
        logger.info('spent %s btc in transaction %s',
                    bitcore.Unit.fromSatoshis(diff).toBTC(),
                    tx.id)

        // download used unspent
        self.unspents = self.unspents.filter(function (unspent) {
          return _.find(unspents, unspent) === undefined
        })

        // scan sended tx for change
        timers.setImmediate(self._scanTx.bind(self), tx)
      })
  })
})

module.exports = require('soop')(Wallet)
