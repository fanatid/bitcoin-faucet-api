/* globals Promise:true */

var _ = require('lodash')
var Promise = require('bluebird')
var bitcore = require('bitcore')
var Mnemonic = require('bitcore-mnemonic')

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
  self._cachedBalance = null

  self.network = bitcore.Networks.get(config.get('wallet.network'))
  if (self.network === undefined) {
    throw new errors.Wallet.InvalidNetwork(config.get('wallet.network'))
  }

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

  self.unspents = []

  var scanTx = util.makeSerial(function (txId, outputIndex) {
    logger.verbose('scan tx %s', txId)

    return provider.getTx(txId)
      .then(function (rawTx) {
        var tx = new bitcore.Transaction(rawTx)
        tx.outputs.forEach(function (output, vout) {
          if (outputIndex !== undefined && outputIndex !== vout) {
            return
          }

          try { output.script } catch (e) { return }

          var address = output.script.toAddress(self.network).toString()
          if (self.addresses[address] === undefined) {
            return
          }

          var unspent = {
            address: address,
            txId: txId,
            vout: vout,
            value: output.satoshis
          }
          if (_.find(self.unspents, unspent) !== undefined) {
            return
          }

          self.unspents.push(unspent)
          self.unspents = _.sortBy(self.unspents, 'value')

          self._cachedBalance = null
          logger.info('find unspent for %s (+%s btc, total: %s btc)',
                      unspent.address,
                      bitcore.Unit.fromSatoshis(unspent.value).toBTC(),
                      bitcore.Unit.fromSatoshis(self.getBalance()).toBTC())

          if (unspent.value > 5000000) {
            setTimeout(function () {
              /* @todo */
              logger.info('trying split coins')
              // self.sendTo()
            }, 0)
          }
        })
      })
  })

  _.forEach(self.addresses, function (privKey, address) {
    provider.subscribe(address, scanTx)
  })

  function onConnect () {
    _.forEach(self.addresses, function (privKey, address) {
      provider.getUnspents(address)
        .then(function (unspents) {
          unspents.forEach(function (unspent) {
            scanTx(unspent.txid, unspent.vout)
          })
        })
    })
  }
  provider.socket.on('connect', onConnect)
  if (provider.socket.connected) {
    onConnect()
  }
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

    var totalValue = _.sum(_.pluck(recipients, 'value')) + 10000
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

    _.forEach(value.unspents, function (unspent) {
      tx = tx.from({
        txId: unspent.txId,
        outputIndex: unspent.vout,
        script: bitcore.Script.buildPublicKeyHashOut(unspent.address),
        satoshis: unspent.value
      })
    })

    _.forEach(recipients, function (recipient) {
      tx = tx.to(recipient.address, recipient.value)
    })

    tx = tx.change(self.getRandomAddress())

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
