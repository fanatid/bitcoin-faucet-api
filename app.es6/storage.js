import _ from 'lodash'
import PUtils from 'promise-useful-utils'
import { mixin } from 'core-decorators'
import ReadyMixin from 'ready-mixin'

import config from './config'
import logger from './logger'
import SQL from './sql'

let pg = PUtils.promisifyAll(require('pg'))

/**
 * @class Storage
 * @mixes ReadyMixin
 */
@mixin(ReadyMixin)
export default class Storage {
  _version = '1'

  /**
   * @constructor
   */
  constructor () {
    this._url = config.get('postgresql.url')

    pg.defaults.poolSize = config.get('postgresql.poolSize', 10)

    this._checkEnv()
      .then(() => this._ready(null), (err) => this._ready(err))

    this.ready
      .then(() => logger.info('Storage ready...'))
  }

  /**
   * @return {Promise}
   */
  _checkEnv (client) {
    return this.runTransaction(async (client) => {
      let names = SQL.create.tables.map(q => /TABLE (.*) \(/.exec(q)[1])
      let result = await client.queryAsync(SQL.select.tablesCount, [names])
      let count = parseInt(result.rows[0].count, 10)
      logger.info(`Found ${count} tables`)

      if (count === 0) {
        await this._createEnv(client)
      } else if (count !== _.keys(SQL.create.tables).length) {
        throw new Error('Found wrong tables count')
      }

      let [version, network] = await* [
        client.queryAsync(SQL.select.info.value, ['version']),
        client.queryAsync(SQL.select.info.value, ['network'])
      ]

      // check version
      if (version.rowCount !== 1 ||
          version.rows[0].value !== this._version) {
        throw new Error(`Expect version ${this._version}, find ${version.rows[0].value}`)
      }

      // check network
      if (network.rowCount !== 1 ||
          network.rows[0].value !== config.get('wallet.network')) {
        throw new Error(`Expect network ${config.get('wallet.network')}, find ${network.rows[0].value}`)
      }

      // delete unused preload types
      await client.queryAsync(SQL.delete.preloadType.empty)
    })
  }

  /**
   * @param {pg.Client} client
   * @return {Promise}
   */
  async _createEnv (client) {
    logger.info('Creating db tables...')
    for (let query of SQL.create.tables) {
      await client.queryAsync(query)
    }

    logger.info('Creating db indices...')
    await* SQL.create.indices.map((query) => client.queryAsync(query))

    let version = this._version
    let network = config.get('wallet.network')

    logger.info('Insert version and network to info...')
    await* [
      client.queryAsync(SQL.insert.info.row, ['version', version]),
      client.queryAsync(SQL.insert.info.row, ['network', network])
    ]
  }

  /**
   * @param {function} fn
   * @return {Promise}
   */
  async connect (fn) {
    let [client, done] = await pg.connectAsync(this._url)
    try {
      let result = await fn(client)
      done()
      return result
    } catch (err) {
      client.end()
      throw err
    }
  }

  /**
   * @param {string} query
   * @param {Array.<*>} [params]
   * @return {Promise}
   */
  run (query, params) {
    return this.connect((client) => {
      return client.queryAsync(query, params)
    })
  }

  /**
   * @param {function} fn
   * @return {Promise}
   */
  runTransaction (fn) {
    return this.connect(async (client) => {
      await client.queryAsync('BEGIN')
      try {
        var result = await fn(client)
      } catch (err) {
        await client.queryAsync('ROLLBACK')
        throw err
      }

      await client.queryAsync('COMMIT')
      return result
    })
  }
}
