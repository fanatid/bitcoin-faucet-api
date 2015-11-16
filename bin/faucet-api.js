#!/usr/bin/env node

require('babel-runtime/core-js/promise').default = require('bluebird')
require('timers').setImmediate(require('../app'))
