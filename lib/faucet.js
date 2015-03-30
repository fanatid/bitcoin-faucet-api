/* globals Promise:true */

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
 * @param {number} type
 * @return {Promise}
 */
Faucet.prototype.getUnspents = function (type) {
  console.log(type)
  return Promise.resolve()
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
    return Promise.reject(new errors.Faucet.InvalidValue(value, minValue, maxValue))
  }

  return wallet.sendTo([{address: address, value: value}])
    .then(function (txId) {
      return {value: value, toAddress: address, txId: txId}
    })
}

module.exports = require('soop')(Faucet)
