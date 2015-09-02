var multiplex = require('multiplex')
var pump = require('pump')

module.exports = function (store) {
  var plex = multiplex(function (stream, key) {
    if (key[0] === 'w') pump(stream, store.createWriteStream(key.slice(2)))
    else pump(store.createReadStream(key.slice(2), stream))
  })

  plex.createWriteStream = function (key) {
    return plex.createStream('w/' + key)
  }

  plex.createReadStream = function (key) {
    return plex.createStream('r/' + key)
  }

  return plex
}
