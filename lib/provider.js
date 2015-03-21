/* globals Promise:true */

var Promise = require('bluebird')
var CbInsight = require('cb-insight')

var config = require('./config')
var errors = require('./errors')

var provider
switch (config.get('provider.name')) {
  case 'cb-insight':
    provider = new CbInsight(config.get('provider.insightUrl'))
    break
  default:
    throw new errors.UnknowProvider(config.get('provider.name'))
}

provider.addresses = Promise.promisifyAll(provider.addresses)
provider.transactions = Promise.promisifyAll(provider.transactions)

module.exports = Promise.promisifyAll(provider)
