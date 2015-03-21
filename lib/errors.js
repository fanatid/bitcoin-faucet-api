var errorSystem = require('error-system')

/**
 * Error
 *  +-- Wallet
 *  |    +-- InvalidNetwork
 *  |    +-- InvalidMnemonic
 *  +-- UnknowProvider
 */

module.exports = errorSystem.extend(Error, [{
  name: 'Wallet',
  message: 'Wallet internal error',
  errors: [{
    name: 'InvalidNetwork',
    message: 'Invalid network: {0}'
  }]
}, {
  name: 'InvalidMnemonic',
  message: 'Invalid mnemonic: {0}'
}])
