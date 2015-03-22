/* globals Promise:true */

var Promise = require('bluebird')

var config = require('./config')
var wallet = require('./wallet').default()

/**
 * class Faucet
 */
function Faucet () {
}

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
  // check address and value

  return wallet.sendTo([{address: address, value: value}])
    .then(function (txId) {
      return {value: value, toAddress: address, txId: txId}
    })
}

module.exports = require('soop')(Faucet)
