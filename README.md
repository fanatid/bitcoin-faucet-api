# bitcoin-faucet

[![build status](https://img.shields.io/travis/fanatid/bitcoin-faucet.svg?branch=master&style=flat-square)](http://travis-ci.org/fanatid/bitcoin-faucet)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

Bitcoin faucet service

  * [Requirements](#requirements)
  * [Installation](#installation)
  * [API](#api)
  * [License](#license)

Plans:
  * colored coin support (after coloredcoinjs-lib@1.0.0 will be released?)
  * integrate cc-wallet-core (after v1.0.0 will be released?)

## Requirements

  * [node.js](http://www.nodejs.org/download/) (testned only with v0.10)

## Installation

  Clone repository:

    $ git clone https://github.com/fanatid/bitcoin-faucet.git && cd bitcoin-faucet

  Install dependencides:

    $ npm install

  Copy defeault config and edit:

    $ cp config/api-default.yml config/api-my.yml && vim config/api-my.yml

  Run faucet-api:

    $ ./bin/faucet-api.js -c config/api-my.yml

## API

  * [preload](#preload)
  * [withdrawal](#withdrawal)
  * [donation](#donation)
  * [status](#status)
  * [version](#version)

### preload

    /preload?type={typeName}

Sample return:

    {
      "status": "success",
      "data": {
        "mnemonic": "prepare wait latin vivid distance ice barrel chapter link dynamic lecture december",
        "passphrase": "7da79e82",
        "seed": "749cba292bf5cc52358703610e4788f0fd6ed8b8cfaacf594e6a2e36a72f3d165917b310065616ca6c114c24ccb7dc518ba67c41de029e17efa8dd48dc4d81db",
        "rootHDPrivateKey": "tprv8ZgxMBicQKsPf2dRcXnaM3t7J9RZoWPrnNRcogorUTjUMGaWXXad94ou9Mv4F6WWMs9QuE9c9VU3e5UJJELfvvaCPq88pu5oJGC4YtHancZ",
        "privateKeyWIF": "cNbmTJj7HrEXPGQ84XxpCw4Dgv9dBiF8NDXGxSLtD2tJaz6Dz9QK",
        "address": "mypDQozM9mRUjp4ucHHj21NkvVcJaHKzXJ",
        "unspents": [{
          "txId": "6577fc98d3d6851d3e4bf857dc68d6b08acce1313f4d7ff23dda8698b0a35803",
          "vout": 6,
          "value": 25000
        }, {
          "txId": "6577fc98d3d6851d3e4bf857dc68d6b08acce1313f4d7ff23dda8698b0a35803",
          "vout": 7,
          "value": 25000
        }]
      }
    }

### withdrawal

    /withdrawal?toAddress={address}&value={value}

Sample return:

    {
      "status": "success",
      "data": {
        "value": 1000000,
        "toAddress": "moeApce3EQcKbGptsiB9Lg8RnXHzvNZrHb",
        "txId": "906ecb5cc79261a1b02206bbc2ea49b9444e73572f6c19692ec29f32a08a2035"
      }
    }

### donation

    /donation

Sample return:

    {
      "status": "success",
      "data": {
        "address": "moioSiDRH5rtNz9jgYLPaDC1Ek8HMu4zpE"
      }
    }

### status

    /status

Sample return:

    {
      "status": "success",
      "data": {
        "faucet": {
          "withdrawal": {
            "max": 1000000
          },
          "unspents": {
            "stockpile": 5,
            "issueLowerBound": 2,
            "types": [{
              "available": 4,
              "name": "1",
              "preload": [100000]
            }, {
              "available": 6,
              "name": "2",
              "preload": [25000, 25000]
            }, {
              "available": 4,
              "name": "3",
              "preload": [100000, 50000, 10000]
            }]
          }
        },
        "wallet": {
          "network": "testnet",
          "balance": 92070329
        }
      }
    }

### version

    /version

Sample return:

    {
      "status": "success",
      "data": {
        "version": "0.0.1"
      }
    }

## License

Code released under [the MIT license](https://github.com/fanatid/bitcoin-faucet/blob/master/LICENSE).
