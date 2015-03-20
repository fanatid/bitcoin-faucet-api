var winston = require('winston')
var config = require('./config')

var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: 'error',
      colorize: true,
      timestamp: true
    })
  ]
})
logger.transports.console.level = config.get('loggerlevel')

module.exports.logger = logger
