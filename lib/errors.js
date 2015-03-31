var errorSystem = require('error-system')

/**
 * Error
 *  +-- Faucet
 *  |    +-- InvalidAddress
 *  |    +-- InvalidPreloadType
 *  |    +-- InvalidValue
 *  +-- Wallet
 *  |    +-- InsufficientFunds
 *  |    +-- InsufficientPreloads
 *  |    +-- InvalidNetwork
 *  |    +-- InvalidMnemonic
 *  +-- UnknowProvider
 */

module.exports = errorSystem.extend(Error, [{
  name: 'Faucet',
  message: 'Faucet internal error',
  errors: [{
    name: 'InvalidAddress',
    message: 'Invalid address: {0}'
  }, {
    name: 'InvalidPreloadType',
    message: 'Invalid preload type: {0}'
  }, {
    name: 'InvalidValue',
    message: 'Invalid value: {0} (should be in range of from {1} to {2})'
  }]
}, {
  name: 'Wallet',
  message: 'Wallet internal error',
  errors: [{
    name: 'InsufficientFunds',
    message: '{0} requested, {1} found'
  }, {
    name: 'InsufficientPreloads',
    message: 'Not found preloads for type {0}'
  }, {
    name: 'InvalidNetwork',
    message: 'Invalid network: {0}'
  }, {
    name: 'InvalidMnemonic',
    message: 'Invalid mnemonic: {0}'
  }]
}, {
  name: 'UnknowProvider',
  message: 'Unknow provider: {0}'
}])
