/* globals Promise:true */
var _ = require('lodash')
var Promise = require('bluebird')

/**
 * @param {function} fn
 * @return {function}
 */
function makeSerial (fn) {
  var queue = []

  return function () {
    var ctx = this
    var args = _.slice(arguments)

    var deferred = Promise.defer()

    queue.push(deferred)
    if (queue.length === 1) {
      queue[0].resolve()
    }

    return deferred.promise
      .then(function () { return fn.apply(ctx, args) })
      .finally(function () {
        queue.shift()
        if (queue.length > 0) {
          queue[0].resolve()
        }
      })
  }
}

module.exports = {
  makeSerial: makeSerial
}
