# bitcoin-faucet-api

[![build status](https://img.shields.io/travis/fanatid/bitcoin-faucet-api.svg?branch=master&style=flat-square)](http://travis-ci.org/fanatid/bitcoin-faucet-api)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
[![Dependency status](https://img.shields.io/david/fanatid/bitcoin-faucet-api.svg?style=flat-square)](https://david-dm.org/fanatid/bitcoin-faucet-api#info=dependencies)
[![Dev Dependency status](https://img.shields.io/david/fanatid/bitcoin-faucet-api.svg?style=flat-square)](https://david-dm.org/fanatid/bitcoin-faucet-api#info=devDependencies)

  * [Requirements](#requirements)
  * [Installation](#installation)
  * [API](#api)
  * [License](#license)

## Requirements

  * [node.js](https://nodejs.org/) (tested only with latest version)

## Installation

  Clone repository:

    $ git clone https://github.com/fanatid/bitcoin-faucet-api.git && cd bitcoin-faucet-api

  Install dependencides:

    $ npm install

  Compile to es5 from es6 with babel:

    $ npm run compile

  Copy defeault config and edit:

    $ cp config/default.yml config/local.yml && vim config/local.yml

  Run faucet-api:

    $ ./bin/faucet-api.js -c config/api-my.yml

## API

  * [preload](#preload)
  * [withdrawal](#withdrawal)
  * [donation](#donation)
  * [version](#version)

#### preload

  **url**

    /v1/preload

  **query**

| param | description       |
|:------|:------------------|
| name  | preload type name |

  **result**

    {
      "status": "success",
      "data": {
        "mnemonic": "prepare wait latin vivid distance ice barrel chapter link dynamic lecture december",
        "passphrase": "7da79e82",
        "seed": "749cba292bf5cc52358703610e4788f0fd6ed8b8cfaacf594e6a2e36a72f3d165917b310065616ca6c114c24ccb7dc518ba67c41de029e17efa8dd48dc4d81db",
        "privateKeyHDRoot": "tprv8ZgxMBicQKsPf2dRcXnaM3t7J9RZoWPrnNRcogorUTjUMGaWXXad94ou9Mv4F6WWMs9QuE9c9VU3e5UJJELfvvaCPq88pu5oJGC4YtHancZ",
        "privateKeyWIF": "cNbmTJj7HrEXPGQ84XxpCw4Dgv9dBiF8NDXGxSLtD2tJaz6Dz9QK", // chain always is m/0/0/0
        "address": "mypDQozM9mRUjp4ucHHj21NkvVcJaHKzXJ",
        "unspent": [{
          "txId": "6577fc98d3d6851d3e4bf857dc68d6b08acce1313f4d7ff23dda8698b0a35803",
          "outputIndex": 6,
          "satoshis": 25000,
          "script": "76a914c8b5f43e596d395de9c30b3ce1d89e2a7a27172e88ac"
        }, {
          "txId": "6577fc98d3d6851d3e4bf857dc68d6b08acce1313f4d7ff23dda8698b0a35803",
          "outputIndex": 7,
          "satoshis": 25000,
          "script": "76a914c8b5f43e596d395de9c30b3ce1d89e2a7a27172e88ac"
        }]
      }
    }

#### withdrawal

  **url**

    /v1/withdrawal

  **query**

| param    | description                   |
|:---------|:------------------------------|
| address  | bitcoin address               |
| satoshis | withdrawal amount in satoshis |

  **result**

    {
      "status": "success",
      "data": {
        "address": "moeApce3EQcKbGptsiB9Lg8RnXHzvNZrHb",
        "txId": "906ecb5cc79261a1b02206bbc2ea49b9444e73572f6c19692ec29f32a08a2035",
        "outputIndex": 0,
        "satoshis": 1000000,
        "script": "76a914591e5ffc8e07032b02b0be154cded1ff88d0fcc888ac"
      }
    }

#### donation

  **url**

    /v1/donation

  **result**

    {
      "status": "success",
      "data": {
        "address": "moioSiDRH5rtNz9jgYLPaDC1Ek8HMu4zpE"
      }
    }

#### status

  **url**

    /version

  **result**

    {
      "status": "success",
      "version": "0.1.0"
      "config": {
        "insight": {
          "url": http://test-insight.bitpay.com/api"
        },
        "wallet": {
          "network": "testnet",
          "utxosCount": 28,
          "balance": 511915368
        },
        "faucet": {
          "withdrawal": {
            "max": 1000000
          },
          "preload": {
            "types": [{
              "name": "100k",
              "count": 100,
              "values": [100000]
            }, {
              "name": "2x25k",
              "count": 100,
              "values": [25000, 25000]
            }]
          }
        }
      }
    }

## License

Code released under [the MIT license](https://github.com/fanatid/bitcoin-faucet-api/blob/master/LICENSE).
