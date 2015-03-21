/* globals Promise:true */

var inherits = require('util').inherits
var EventEmitter = require('events').EventEmitter
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
}

inherits(Storage, EventEmitter)

/**
 * @return {boolean}
 */
Storage.prototype.isReady = function () { return this._isReady }

/**
 * @typedef Storage~WalletUnspent
 * @property {string} address
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 */

/**
 * @param {Array.<Storage~WalletUnspent>} unspents
 * @return {Promise}
 */
Storage.prototype.saveWalletUnspents = function (unspents) {}

module.exports = Storage
