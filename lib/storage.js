/* globals Promise:true */

var _ = require('lodash')
var Promise = require('bluebird')
var NeDB = require('nedb')

var config = require('./config')

/**
 * @class Storage
 */
function Storage () {
  var dbOpts = {filename: config.get('storage.filename'), autoload: true}
  this._db = Promise.promisifyAll(new NeDB(dbOpts))
  this._db.persistence.setAutocompactionInterval(
    config.get('storage.compactionInterval') * 1000)
}

/**
 * @return {Promise<Array.<Wallet~UnspentObject>>}
 */
Storage.prototype.loadWalletUnspents = function () {
  return this._db.findAsync({owner: 'wallet'})
    .then(function (docs) {
      _.each(docs, function (v) {
        delete v._id
        delete v.owner
      })
      return docs
    })
}

/**
 * @param {Wallet~UnspentObject} unspent
 * @return {Promise}
 */
Storage.prototype.insertWalletUnspent = function (unspent) {
  var doc = _.extend({owner: 'wallet'}, unspent)
  return this._db.insertAsync(doc)
}

/**
 * @param {Wallet~UnspentObject} unspent
 * @return {Promise}
 */
Storage.prototype.removeWalletUnspent = function (unspent) {
  var doc = _.extend({owner: 'wallet'}, unspent)
  return this._db.removeAsync(doc)
}

module.exports = require('soop')(Storage)
