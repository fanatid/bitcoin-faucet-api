import _ from 'lodash'
import bitcore from 'bitcore-lib'

import { version as VERSION } from '../../package.json'

export default {
  preload: (req, res) => {
    res.promise(req.wallet.getPreload(req.query.name))
  },

  withdrawal: (req, res) => {
    // check address
    let address = req.query.address
    if (!bitcore.Address.isValid(address, req.wallet.getNetwork())) {
      return res.jfail(`Invalid address ${address}`)
    }

    // check amount
    let satoshis = parseInt(req.query.satoshis, 10)
    if (!_.isFinite(satoshis)) {
      return res.jfail(`Invalid amount ${req.query.satoshis}`)
    }

    res.promise(req.wallet.makeWithdrawal(address, satoshis))
  },

  donation: (req, res) => {
    res.promise(Promise.resolve({
      address: req.wallet.getRandomAddress()
    }))
  },

  status: (req, res) => {
    res.promise(Promise.resolve(req.wallet.getStatus()))
  },

  version: (req, res) => {
    res.promise(Promise.resolve({version: VERSION}))
  }
}
