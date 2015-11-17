import _ from 'lodash'
import { setImmediate } from 'timers'
import { mixin } from 'core-decorators'
import ReadyMixin from 'ready-mixin'
import makeConcurrent from 'make-concurrent'
import bitcore from 'bitcore-lib'
import Mnemonic from 'bitcore-mnemonic'

import config from './config'
import errors from './errors'
import logger from './logger'
import SQL from './sql'
import { isValid } from './util'

let SIGHASH_ALL = bitcore.crypto.Signature.SIGHASH_ALL

/**
 * @typedef {Object} Wallet~PreloadUnspentObject
 * @property {string} txId
 * @property {number} outputIndex
 * @property {number} satoshis
 * @property {string} script
 */

/**
 * @typedef {Object} Wallet~PreloadObject
 * @property {string} mnemonic
 * @property {string} passphrase
 * @property {string} seed
 * @property {string} privateKeyHDRoot
 * @property {string} privateKeyWIF
 * @property {string} address
 * @property {Wallet~PreloadUnspentObject[]} unspent
 */

/**
 * @typedef {Object} Wallet~WithdrawalObject
 * @property {string} address
 * @property {string} txId
 * @property {number} outputIndex
 * @property {number} satoshis
 * @property {string} script
 */

/**
 * @typedef {Object} Wallet~StatusPreloadObject
 * @property {string} name
 * @property {number} count
 * @property {number[]} values
 */

/**
 * @typedef {Object} Wallet~StatusObject
 * @property {{url: string}} insight
 * @property {{network: string, balance: number}} wallet
 * @property {{withdrawal: {max: number}, preload: {types: Wallet~StatusPreloadObject[]}}} faucet
 */

/**
 * @class Wallet
 * @mixes ReadyMixin
 */
@mixin(ReadyMixin)
export default class Wallet {
  /**
   * @constructor
   * @param {Storage} storage
   * @param {Insight} insight
   */
  constructor (storage, insight) {
    this._storage = storage
    this._insight = insight

    this._network = null
    this._privateKeys = {}
    this._txFeePerKb = bitcore.Transaction.FEE_PER_KB
    this._utxos = []
    this._utxosMaxUnspentAmount = 1e3 * 1e8
    this._utxosTotalAmount = 0

    this._withdrawalMax = null
    this._preloadTypes = {}

    this._storage.ready
      .then(::this._init)
      .then(() => this._ready(null), err => this._ready(err))

    this.ready
      .then(() => logger.info('Wallet ready...'))
  }

  /**
   * @private
   * @return {Promise}
   */
  async _init () {
    // check network
    this._network = bitcore.Networks.get(config.get('wallet.network'))
    isValid(this._network, x => !_.isUndefined(x), 'Network')

    // check mnemonic
    let mnemonic = config.get('wallet.mnemonic')
    isValid(mnemonic, Mnemonic.isValid, 'Mnemonic')

    // generate addresses pool
    let passphrase = config.get('wallet.passphrase')
    let privateKeyRoot = new Mnemonic(mnemonic).toHDPrivateKey(passphrase, this._network)
    let privateKeyChain = privateKeyRoot.derive('m/0/0')
    let poolSize = config.get('wallet.addressesPoolSize')
    isValid(poolSize, [_.isFinite, x => x > 0], 'Addresses pool size')
    this._privateKeys = _.zipObject(_.range(poolSize).map((index) => {
      let privateKey = privateKeyChain.derive(index).privateKey
      let address = privateKey.toAddress(this._network).toString()
      return [address, privateKey]
    }))

    // get unspent max amount
    let maxAmount = config.get('wallet.unspentMaxAmount', this._utxosMaxUnspentAmount)
    isValid(maxAmount, [_.isFinite, x => x > 1e4], 'Unspent max amount')
    this._utxosMaxUnspentAmount = maxAmount

    // get fee per kb
    let feePerKb = config.get('wallet.feePerKB', this._txFeePerKb)
    isValid(feePerKb, [_.isFinite, x => x > 0], 'Fee per Kb')
    this._txFeePerKb = feePerKb

    // load withdrawal max
    this._withdrawalMax = config.get('faucet.withdrawal.max')
    isValid(this._withdrawalMax, [_.isFinite, x => x > 2730], 'Maximum withdrawal')

    // load preload types
    await* config.get('faucet.unspent.types').map(async (item) => {
      let name = item.name.toString()

      // check (name, values) uniqueness
      let values = item.values
      let result = await this._storage.executeQuery(SQL.select.preloadType.values, [name])
      if (result.rows.length > 0 && result.rows[0].values !== JSON.stringify(values)) {
        throw new Error(`Expected ${result.rows[0].values} for ${name} got ${JSON.stringify(values)}`)
      }
      if (result.rows.length === 0) {
        result = await this._storage.executeQuery(SQL.insert.preloadType.row, [name, JSON.stringify(values)])
      }
      let preloadTypeId = result.rows[0].id

      // check issueLowerBound
      let issueLowerBound = _.get(item, 'issueLowerBound', config.get('faucet.unspent.issueLowerBound'))
      isValid(issueLowerBound, [_.isFinite, x => x > 0], `${name} issueLowerBound`)

      // check issuePerOneTx
      let issuePerOneTx = _.get(item, 'issuePerOneTx', config.get('faucet.unspent.issuePerOneTx'))
      isValid(issuePerOneTx, [_.isFinite, x => x > 0], `${name} issuePerOneTx`)

      // save preload
      this._preloadTypes[name] = {
        preloadTypeId: preloadTypeId,
        values: values,
        count: 0,
        issueLowerBound: issueLowerBound,
        issuePerOneTx: issuePerOneTx,
        lock: makeConcurrent((fn) => { return fn.apply(this, arguments) }, {concurrency: 1})
      }
    })

    // update utxos
    await this._utxosUpdate()

    // update preloads
    for (let name of _.keys(this._preloadTypes)) {
      // get count
      await this._preloadUpdateCount(name)
      // issue new if required
      setImmediate(this._preloadIssueNew.bind(this, name))
    }
  }

  /**
   * @return {bitcore.Transaction}
   */
  _txNew () {
    let tx = new bitcore.Transaction()
    tx.feePerKb(this._txFeePerKb)
    tx.change(this.getRandomAddress())
    return tx
  }

  /**
   * @param {bitcore.Transaction} tx
   * @param {Insight~UnspentObject[]} utxos
   */
  _txSign (tx, utxos) {
    let applySignature = ::tx.applySignature

    let indexedUTXOs = _.indexBy(utxos, 'script')
    for (let [index, input] of tx.inputs.entries()) {
      let address = indexedUTXOs[input.output.script.toHex()].address
      // get private key and create hashData
      let privateKey = this._privateKeys[address]
      let hashData = bitcore.crypto.Hash.sha256ripemd160(privateKey.publicKey.toBuffer())
      // get and apply signatures
      input.getSignatures(tx, privateKey, index, SIGHASH_ALL, hashData).map(applySignature)
    }
  }

  /**
   * @private
   * @param {function} fn
   * @return {Promise<*>}
   */
  @makeConcurrent({concurrency: 1})
  _utxosLock (fn) {
    return fn.apply(this, arguments)
  }

  /**
   * @private
   * @return {Promise}
   */
  _utxosUpdate () {
    return this._utxosLock(async () => {
      let utxosNew
      while (true) {
        // get from insight
        utxosNew = await this._insight.getUnspent(_.keys(this._privateKeys))

        // filter too much unspent
        let utxos = utxosNew.filter(utxo => utxo.satoshis > this._utxosMaxUnspentAmount)
        if (_.sum(utxos, 'satoshis') < 1.1 * this._utxosMaxUnspentAmount) {
          break
        }

        // split all big utxos in one transaction
        let tx = this._txNew().from(utxos)
        for (let count = Math.floor((tx.inputAmount - 1e5) / this._utxosMaxUnspentAmount); count > 0; --count) {
          tx.to(this.getRandomAddress(), this._utxosMaxUnspentAmount)
        }

        // sign
        this._txSign(tx, utxos)

        // send to insight
        await this._insight.sendTx(tx)

        // sleep for while process new tx
        await new Promise(resolve => setTimeout(resolve, 3000))
      }

      // save and calculate new balance
      this._utxos = _.sortBy(utxosNew, utxo => -utxo.satoshis)
      this._utxosTotalAmount = _.sum(this._utxos, 'satoshis')
      logger.info(`Update UTXOS, new balance: ${this._utxosTotalAmount}`)
    })
  }

  /**
   * @private
   * @param {bitcore.Transaction} tx
   * @param {boolean} wait
   * @return {Promise<boolean>}
   */
  async _utxosFinishTx (tx, wait) {
    let getRequiredAmount = () => tx.outputAmount + tx.getFee() + 1e6

    while (true) {
      // update UTXO if required
      if (getRequiredAmount() > this._utxosTotalAmount) {
        await this._utxosUpdate()
      }

      let success = await this._utxosLock(async () => {
        // make sure that have enough coins
        if (getRequiredAmount() > this._utxosTotalAmount) {
          logger.warn(`Insufficient funds! Required: ${getRequiredAmount()}, available: ${this._utxosTotalAmount}`)
          return false
        }

        // collect utxos
        let utxos = []
        let savedOutputAmount = tx.outputAmount
        while (tx.inputAmount - savedOutputAmount - tx.getFee() <= 0) {
          utxos.push(this._utxos.pop())
          tx.from(_.last(utxos))
        }
        this._utxosTotalAmount = _.sum(this._utxos, 'satoshis')

        // sign
        this._txSign(tx, utxos)

        return true
      })

      if (success) {
        return true
      }

      if (!wait) {
        return false
      }

      await new Promise(resolve => setTimeout(resolve, 30 * 1000))
    }
  }

  /**
   * @private
   * @param {string} name
   * @return {Promise}
   */
  _preloadUpdateCount (name) {
    let preload = this._preloadTypes[name]
    return preload.lock(async () => {
      let {rows} = await this._storage.executeQuery(SQL.select.preload.count, [name])
      preload.count = parseInt(rows[0].count, 10)
    })
  }

  /**
   * @private
   * @param {string} name
   * @return {Promise}
   */
  _preloadIssueNew (name) {
    let preload = this._preloadTypes[name]
    return preload.lock(async () => {
      if (preload.count > preload.issueLowerBound) {
        return
      }

      // create tx
      let tx = this._txNew()

      // create preload and add outputs
      let preloadObjs = _.range(preload.issuePerOneTx).map(() => {
        let mnemonic = new Mnemonic()
        let passphrase = bitcore.crypto.Random.getRandomBuffer(4).toString('hex')
        let seed = mnemonic.toSeed(passphrase).toString('hex')
        let privateKeyHDRoot = mnemonic.toHDPrivateKey(passphrase, this._network)
        let privateKey = privateKeyHDRoot.derive('m/0/0/0').privateKey
        let address = privateKey.toAddress(this._network).toString()

        for (let amount of preload.values) {
          tx.to(address, amount)
        }

        return {
          mnemonic: mnemonic.phrase,
          passphrase: passphrase,
          seed: seed,
          privateKeyHDRoot: privateKeyHDRoot.toString(),
          privateKeyWIF: privateKey.toWIF(),
          address: address,
          unspent: []
        }
      })

      // add utxos and sign
      await this._utxosFinishTx(tx, true)

      // send to insight
      await this._insight.sendTx(tx)

      // fill unspent in preloads
      let txId = tx.id
      let indexedPreloadObjs = _.indexBy(preloadObjs, 'address')
      for (let [index, output] of tx.outputs.entries()) {
        let address = output.script.toAddress(this._network).toString()
        let preloadObj = indexedPreloadObjs[address]
        if (preloadObj !== undefined) {
          preloadObj.unspent.push({
            txId: txId,
            outputIndex: index,
            satoshis: output.satoshis,
            script: output.script.toHex()
          })
        }
      }

      // save to storage
      await this._storage.executeTransaction((client) => {
        return Promise.all(preloadObjs.map((obj) => {
          let data = JSON.stringify(obj)
          return client.queryAsync(SQL.insert.preload.row, [preload.preloadTypeId, data])
        }))
      })

      // update preload count
      preload.count += preload.issuePerOneTx

      // try more
      setImmediate(this._preloadIssueNew.bind(this, name))

      logger.info(`Preload ${name}, issued: ${preload.issuePerOneTx}, total: ${preload.count}`)
    })
  }

  /**
   * @param {string} name
   * @return {Promise<Wallet~PreloadObject>}
   */
  async getPreload (name) {
    let preload = this._preloadTypes[name]
    if (preload === undefined) {
      throw new errors.JSENDFail(`Preload type ${name} not found`)
    }

    return await preload.lock(async () => {
      if (preload.count === 0) {
        throw new errors.JSENDError(`Preload ${name} not available`)
      }

      // try fetch from storage
      let {rows} = await this._storage.executeQuery(SQL.delete.preload.oldestOne, [preload.preloadTypeId])
      if (rows.length === 0) {
        setImmediate(this._preloadUpdateCount.bind(this, name))
        throw new errors.JSENDError(`Preload ${name} not available`)
      }

      // update count
      preload.count -= 1
      if (preload.count <= preload.issueLowerBound) {
        setImmediate(this._preloadIssueNew.bind(this, name))
      }

      // return parsed preload object
      return JSON.parse(rows[0].data)
    })
  }

  /**
   * @param {string} address
   * @param {number} satoshis
   * @return {Promise<Wallet~WithdrawalObject>}
   */
  async makeWithdrawal (address, satoshis) {
    // check min
    if (satoshis <= bitcore.Transaction.DUST_AMOUNT) {
      throw new errors.JSENDFail(`Requested amount is too small`)
    }

    // check max
    if (satoshis > this._withdrawalMax) {
      throw new errors.JSENDFail(`Max available on faucet is ${this._withdrawalMax}, you request ${satoshis}`)
    }

    try {
      // create tx
      let tx = this._txNew().to(address, satoshis)

      // try finish tx
      let success = await this._utxosFinishTx(tx, false)
      if (!success) {
        throw new errors.JSENDError(`Insufficient funds`)
      }

      // send to insight
      await this._insight.sendTx(tx)

      // create response object
      let scriptHex = new bitcore.Script(new bitcore.Address(address)).toHex()
      for (let [index, output] of tx.outputs.entries()) {
        if (output.script.toHex() === scriptHex) {
          return {
            address: address,
            txId: tx.id,
            outputIndex: index,
            satoshis: satoshis,
            script: scriptHex
          }
        }
      }

      throw new Error(`Can't find withdrawal output in transaction`)
    } catch (err) {
      throw new errors.JSENDFail(err.message)
    }
  }

  /**
   * @return {string}
   */
  getRandomAddress () {
    let addresses = _.keys(this._privateKeys)
    return addresses[_.random(addresses.length - 1)]
  }

  /**
   * @return {Wallet~StatusObject}
   */
  getStatus () {
    return {
      insight: {
        url: this._insight.getURL()
      },
      wallet: {
        network: this._network.name,
        utxosCount: this._utxos.length,
        balance: this._utxosTotalAmount
      },
      faucet: {
        withdrawal: {
          max: this._withdrawalMax
        },
        preloads: {
          types: _.map(this._preloadTypes, (item, name) => {
            return {
              name,
              count: item.count,
              values: item.values
            }
          })
        }
      }
    }
  }

  /**
   * @return {Object}
   */
  getNetwork () {
    return this._network
  }
}
