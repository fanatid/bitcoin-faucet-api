/* globals Promise:true */

var Promise = require('bluebird')
var CbInsight = require('cb-insight')

var config = require('./config')
var errors = require('./errors')

/**
 * @class Provider
 */
function Provider () {
  switch (config.get('provider.name')) {
    case 'cb-insight':
      this._cb = new CbInsight(config.get('provider.insight.url'))
      break
    default:
      throw new errors.UnknowProvider(config.get('provider.name'))
  }

  this._cb.addresses = Promise.promisifyAll(this._cb.addresses)
  this._cb.transactions = Promise.promisifyAll(this._cb.transactions)
}

/**
 * @param {string} address
 * @return {Promise<Array.<Wallet~UnspentObject>>}
 */
Provider.prototype.getUnspents = function (address) {
  return this._cb.addresses.unspentsAsync(address)
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
}

/**
 * @param {string} rawTx
 * @return {Promise<string>}
 */
Provider.prototype.sendTx = function (rawTx) {
  return this._cb.transactions.propagateAsync(rawTx)
}

module.exports = require('soop')(Provider)
