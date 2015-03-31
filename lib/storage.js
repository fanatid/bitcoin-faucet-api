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
 * @param {string} name
 * @return {Promise<number>}
 */
Storage.prototype.getPreloadCount = function (name) {
  return this._db.countAsync({_owner: 'preload', name: name})
}

/**
 * @param {string} name
 * @param {Wallet~PreloadObject} preload
 * @return {Promise}
 */
Storage.prototype.savePreload = function (name, preload) {
  var doc = _.extend({_owner: 'preload', name: name}, preload)
  return this._db.insertAsync(doc)
}

/**
 * @param {string} name
 * @return {Promise<?Wallet~PreloadObject>}
 */
Storage.prototype.getRandomPreload = function (name) {
  return this._db.findOneAsync({_owner: 'preload', name: name})
    .then(function (doc) {
      var id = doc._id
      delete doc._id
      delete doc._owner
      delete doc.name

      return this._db.removeAsync({_id: id}).then(function () { return doc })
    })
}

module.exports = require('soop')(Storage)
