var hyperlog = require('hyperlog')
var trust = require('trust-log')
var hsodium = require('hyperlog-sodium')
var xtend = require('xtend')
var exchange = require('./exchange.js')
var sub = require('subleveldown')
var semver = require('semver')
var Writable = require('readable-stream/writable')
var multiplex = require('multiplex')

module.exports = Appfeed

function Appfeed (db, sodium, opts) {
  var self = this
  if (!(self instanceof Appfeed)) return new Appfeed(db, sodium, opts)
  if (sodium.api) sodium = sodium.api
 
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
    verify: function (node, cb) {
      self._trust.verify(node, cb)
    },
    identity: keypair.publicKey,
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
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!cb) cb = noop
 
  var mux = multiplex()
  var tstream = self._trust.replicate(opts)
  tstream.pipe(mux.createSharedStream('trust')).pipe(tstream)

  tstream.once('finish', function () {
    var astream = self.versions.replicate(opts)
    astream.pipe(mux.createSharedStream('versions')).pipe(astream)
    astream.once('finish', function () {
      fetchApps()
    })
  })
  return mux

  function fetchApps () {
    if (opts.blobs === false) {
      cb(null)
    } else if (opts.heads) {
      self.versions.heads(function (err, heads) {
        if (err) return cb(err)
        else replicate(heads.map(keyof), cb)
      })
    } else {
      collect(self.versions.createReadStream(), function (err, rows) {
        if (err) cb(err)
        else replicate(rows.map(keyof), cb)
      })
    }
  }
 
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

Appfeed.prototype.trusted = function (from, cb) {
  return this._trust.trusted(from, cb)
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
