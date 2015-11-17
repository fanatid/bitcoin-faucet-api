import _ from 'lodash'
import URLJoin from 'url-join'
import request from 'request'
import bitcore from 'bitcore-lib'

import config from './config'
import logger from './logger'

/**
 * @typedef {Object} Insight~UnspentObject
 * @property {string} address
 * @property {string} txId
 * @property {number} outputIndex
 * @property {string} script
 * @property {number} satoshis
 */

/**
 * @class Insight
 */
export default class Insight {
  /**
   * @constructor
   */
  constructor () {
    this._insightURL = config.get('insight.url')
    this._requestTimeout = config.get('insight.timeout')
  }

  /**
   * @private
   * @param {Object} opts
   * @return {Promise<Object>}
   */
  async _request (opts) {
    return new Promise((resolve, reject) => {
      opts = _.extend({
        method: 'GET',
        timeout: this._requestTimeout,
        json: true,
        zip: true
      }, opts)

      logger.verbose(`Make request: ${opts.uri}`)
      request(opts, (err, response) => {
        if (err === null) {
          if (response.statusCode === 200) {
            return resolve(response)
          }

          err = new Error(`Expected statusCode is 200, got ${response.statusCode} (body: ${response.body})`)
        }

        reject(err)
      })
    })
  }

  /**
   * @return {string}
   */
  getURL () {
    return this._insightURL
  }

  /**
   * @param {string[]} addresses
   * @return {Promise<Insight~UnspentObject[]>}
   */
  async getUnspent (addresses) {
    logger.verbose(`getUnspent for addresses: ${addresses}`)

    let response = await this._request({
      uri: URLJoin(this._insightURL, 'addrs', addresses.join(','), 'utxo')
    })

    return response.body.map((item) => {
      return {
        address: item.address,
        txId: item.txid,
        outputIndex: item.vout,
        script: item.scriptPubKey,
        satoshis: bitcore.Unit.fromBTC(item.amount).toSatoshis()
      }
    })
  }

  /**
   * @param {bitcore.Transaction} tx
   * @return {Promise}
   */
  async sendTx (tx) {
    let rawTx = tx.serialize()
    logger.verbose(`sendTx ${tx.id} (size: ${rawTx.length / 2})`)

    await this._request({
      method: 'POST',
      uri: URLJoin(this._insightURL, '/tx/send'),
      json: {rawtx: rawTx}
    })
  }
}
