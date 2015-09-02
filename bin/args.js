#!/usr/bin/env node
var minimist = require('minimist')
var path = require('path')
var fs = require('fs')
var appfeed = require('../')
var sodium = require('sodium').api
var blobs = require('content-addressable-blob-store')
var mkdirp = require('mkdirp')
var home = require('os-homedir')()
var defined = require('defined')
var xtend = require('xtend')
var tty = require('tty')
var through = require('through2')
var semver = require('semver')
var once = require('once')

module.exports = function (args) {
  var argv = minimist(args, {
    default: { dir: path.join(process.cwd(), '.appfeed') },
    alias: { d: 'dir', v: 'version' }
  })

  var dbdir = path.join(argv.dir, 'db')
  var blobdir = path.join(argv.dir, 'blob')
  var keyfile = path.resolve(process.cwd(), defined(
    process.env.APPFEED_KEYFILE,
    argv.keyfile,
    path.join(home, '.config/appfeed/keys.json')
  ))
  mkdirp.sync(dbdir)
  mkdirp.sync(blobdir)
  mkdirp.sync(path.dirname(keyfile))

  if (argv._[0] === 'id') {
    fs.readFile(keyfile, function (err, src) {
      if (err) return fail(err)
      try { var keys = JSON.parse(src) }
      catch (err) { return fail(err.message + ' while parsing ' + keyfile) }
      console.log(keys.publicKey)
    })
  } else if (argv._[0] === 'generate') {
    var keypair = sodium.crypto_sign_keypair()
    var value = JSON.stringify({
      secretKey: keypair.secretKey.toString('hex'),
      publicKey: keypair.publicKey.toString('hex')
    }, null, 2) + '\n'
    fs.stat(keyfile, function (err, s) {
      if (s) return fail('refusing to overwrite existing key file: ' + keyfile)
      fs.writeFile(keyfile, value, function (err) {
        if (err) fail(err)
        else if (tty.isatty()) console.error('wrote to ' + keyfile)
      })
    })
  } else if (argv._[0] === 'versions') {
    var feed = getFeed()
    feed.versions.createReadStream().pipe(
      through.obj(function (row, enc, next) {
        console.log(row.value.version, row.value.key)
        next()
      })
    )
  } else if (argv._[0] === 'show') {
    var feed = getFeed()
    if (semver.valid(argv._[1])) {
      getVersion(feed, argv._[1], function (err, hash) {
        if (err) return fail(err)
        else if (!hash) fail('version not found')
        else showHash(feed, hash)
      })
    } else showHash(feed, argv._[1])
  } else if (argv._[0] === 'publish') {
    var feed = getFeed()
    process.stdin.pipe(feed.publish(argv, function (err, node) {
      if (err) fail(err)
      else console.log(node.key)
    }))
  } else if (argv._[0] === 'trusted') {
    var feed = getFeed()
    feed.trusted(argv._[1], function (err, trusted) {
      if (err) return fail(err)
      trusted.forEach(function (id) {
        console.log(id.toString('hex'))
      })
    })
  } else if (argv._[0] === 'trust') {
    var feed = getFeed()
    feed.trust(argv._[1], function (err) {
      if (err) fail(err)
    })
  } else if (argv._[0] === 'revoke') {
    var feed = getFeed()
    feed.revoke(argv._[1], function (err) {
      if (err) fail(err)
    })
  } else return false
 
  function getFeed () {
    var level = require('level')
    return appfeed(level(dbdir), sodium, xtend({
      store: blobs(blobdir)
    }, require(keyfile)))
  }
}

function fail (err) {
  console.error(err.message || err)
  process.exit(1)
}

function getVersion (feed, version, cb) {
  cb = once(cb)
  var r = feed.versions.createReadStream()
  r.once('error', cb)
  r.pipe(through.obj(write, end))
  function write (row, enc, next) {
    if (row.value.version === version) cb(null, row.value.key)
    else next()
  }
  function end () { cb(null, undefined) }
}

function showHash (feed, hash) {
  var r = feed.store.createReadStream(hash)
  r.once('error', function (err) {
    if (err.code === 'ENOENT') fail('hash not found')
    else fail(err)
  })
  r.pipe(process.stdout)
}
