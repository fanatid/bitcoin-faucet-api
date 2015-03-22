/* globals Promise:true */

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
Faucet.prototype.getUnspents = function (type) {}

/**
 * @param {string} address
 * @param {number} amount
 * @return {Promise}
 */
Faucet.prototype.withdrawal = function (address, amount) {}

module.exports = require('soop')(Faucet)
