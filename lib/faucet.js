/* globals Promise:true */

var _ = require('lodash')
var bitcore = require('bitcore')
var Promise = require('bluebird')

var config = require('./config')
var errors = require('./errors')
var wallet = require('./wallet').default()

/**
 * class Faucet
 */
function Faucet () {}

/**
 * @param {string} type
 * @return {Promise}
 */
Faucet.prototype.getUnspents = function (type) {
  var exists = _.any(config.get('faucet.unspents.types'), function (utype) {
    return utype.name === type
  })
  if (!exists) {
    var err = new errors.Faucet.InvalidPreloadType(type)
    return Promise.reject(err)
  }

  return wallet.getPreload(type)
}

/**
 * @typedef Faucet~WithdrawalObject
 * @property {number} value
 * @property {string} toAddress
 * @property {string} txId
 */

/**
 * @param {string} address
 * @param {number} value
 * @return {Promise<Faucet~WithdrawalObject>}
 */
Faucet.prototype.withdrawal = function (address, value) {
  try {
    bitcore.Address(address)
  } catch (e) {
    return Promise.reject(new errors.Faucet.InvalidAddress(address))
  }

  var minValue = bitcore.Transaction.DUST_AMOUNT
  var maxValue = config.get('faucet.withdrawal.max')
  if (value < minValue || value > maxValue) {
    var err = new errors.Faucet.InvalidValue(value, minValue, maxValue)
    return Promise.reject(err)
  }

  return wallet.sendTo([{address: address, value: value}])
    .then(function (tx) {
      return {value: value, toAddress: address, txId: tx.id}
    })
}

module.exports = require('soop')(Faucet)
