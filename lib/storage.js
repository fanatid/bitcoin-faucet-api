/* globals Promise:true */

var inherits = require('util').inherits
var EventEmitter = require('events').EventEmitter

var _ = require('lodash')
var Promise = require('bluebird')
var NeDB = require('nedb')

var config = require('./config')

/**
 * @event Storage#ready
 */

/**
 * @event Storage#error
 * @param {Error} error
 */

/**
 * @class Storage
 * @extends EventEmitter
 */
function Storage () {
  var self = this
  EventEmitter.call(self)

  self._isReady = false

  var nedb = new NeDB({filename: config.get('storage.filename')})
  self._db = Promise.promisifyAll(nedb)
  self._db.loadDatabaseAsync()
    .catch(function (err) { self.emit('error', err) })
    .then(function () {
      self._isReady = true
      self.emit('ready')
    })
  self._db.persistence.setAutocompactionInterval(
    config.get('storage.compactionInterval') * 1000)
}

inherits(Storage, EventEmitter)

/**
 * @return {boolean}
 */
Storage.prototype.isReady = function () { return this._isReady }

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
