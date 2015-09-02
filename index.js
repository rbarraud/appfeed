var hyperlog = require('hyperlog')
var trust = require('trust-log')
var hsodium = require('hyperlog-sodium')
var xtend = require('xtend')
var exchange = require('./exchange.js')
var sub = require('subleveldown')
var semver = require('semver')
var Writable = require('readable-stream/writable')

module.exports = Appfeed

function Appfeed (db, sodium, opts) {
  var self = this
  if (!(self instanceof Appfeed)) return new Appfeed(db, sodium, opts)
  if (!opts) opts = {}
  var keypair = {
    secretKey: typeof opts.secretKey === 'string'
      ? Buffer(opts.secretKey, 'hex') : opts.secretKey,
    publicKey: typeof opts.publicKey === 'string'
      ? Buffer(opts.publicKey, 'hex') : opts.publicKey
  }
  self._trust = trust(sub(db, 't'), hsodium(sodium, opts, xtend(opts, {
    publicKey: function (id, cb) { self._trust.isTrusted(id, cb) },
    id: opts.publicKey
  })))
  self.versions = hyperlog(sub(db, 'l'), xtend(opts, {
    valueEncoding: 'json',
    verify: function (node, cb) { self._trust.verify(node, cb) },
    sign: function (node, cb) {
      var bkey = Buffer(node.key, 'hex')
      cb(null, sodium.crypto_sign(bkey, keypair.secretKey))
    }
  }))
  self.store = opts.store
}

Appfeed.prototype.replicate = function (opts, cb) {
  var self = this
  if (!opts) opts = {}
  if (!cb) cb = noop
 
  var mux = multiplex()
  if (opts.trust !== false) {
    var tstream = self._trust.replicate()
    tstream.pipe(mux.createStream('trust')).pipe(tstream)
  }
  if (opts.versions !== false) {
    var astream = self.versions.replicate()
    astream.pipe(mux.createStream('versions')).pipe(astream)
  }
 
  if (opts.heads) {
    if (astream) astream.once('finish', function () {
      self.versions.heads(function (err, heads) {
        if (err) return cb(err)
        else replicate(heads.map(keyof), cb)
      })
    })
  } else if (opts.full !== false) {
    if (astream) astream.once('finish', function () {
      collect(self.versions.createReadStream(), function (err, rows) {
        if (err) cb(err)
        else replicate(rows.map(keyof), cb)
      })
    })
  }
  return mux
 
  function replicate (keys, cb) {
    var ex = exchange(self.store)
    ex.pipe(mux.createSharedStream('exchange')).pipe(ex)
 
    var pending = 1
    keys.forEach(function (key) {
      pending ++
      ex.createReadStream(key)
        .pipe(self.store.createWriteStream(key))
        .on('finish', done)
    })
    done()
    function done () { if (--pending === 0) cb(null) }
  }
}

Appfeed.prototype.trust = function (id, cb) {
  this._trust.trust(id, cb)
}

Appfeed.prototype.revoke = function (id, cb) {
  this._trust.revoke(id, cb)
}

Appfeed.prototype.publish = function (doc, cb) {
  var self = this
  if (!cb) cb = noop
  if (!doc.version) return error('doc.version not provided')
  if (typeof doc.version !== 'string') {
    return error('doc.version must be a string')
  } else if (!semver.valid(doc.version)) {
    return error('invalid semver')
  }
  return self.store.createWriteStream(function (err, w) {
    doc.key = w.key
    self.versions.append(doc, cb)
  })
  function error (msg) {
    var err = new Error(msg)
    process.nextTick(function () { cb(err) })
    return new Writable
  }
}

function noop () {}
function keyof (row) { return row.key }
