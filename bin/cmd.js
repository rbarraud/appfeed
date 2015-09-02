#!/usr/bin/env node
var minimist = require('minimist')
var path = require('path')
var fs = require('fs')

var argv = minimist(process.argv.slice(2), {
  default: { dir: path.join(process.cwd(), 'appfeed') },
  alias: { d: 'dir', v: 'version' }
})
if (argv.help || argv._[0] === 'help') return usage(0)

var appfeed = require('../')
var sodium = require('sodium').api
var blobs = require('content-addressable-blob-store')
var mkdirp = require('mkdirp')
var home = require('os-homedir')()
var defined = require('defined')
var xtend = require('xtend')
var tty = require('tty')
var through = require('through2')

var dbdir = path.join(argv.dir, 'db')
var blobdir = path.join(argv.dir, 'blob')
var keyfile = path.resolve(process.cwd(), defined(
  process.env.APPFEED_KEYFILE,
  argv.keyfile,
  path.join(home, '.config', 'appfeed.json')
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
  var level = require('level')
  var feed = appfeed(level(dbdir), sodium, xtend({
    store: blobs(blobdir)
  }, require(keyfile)))
  feed.versions.createReadStream().pipe(
    through.obj(function (row, enc, next) {
      console.log(row.value.version, row.value.key)
      next()
    })
  )
} else if (argv._[0] === 'server') {
  // ...
} else if (argv._[0] === 'publish') {
  var level = require('level')
  var feed = appfeed(level(dbdir), sodium, xtend({
    store: blobs(blobdir)
  }, require(keyfile)))
  process.stdin.pipe(feed.publish(argv, function (err, node) {
    if (err) fail(err)
    else console.log(node.key)
  }))
}

function usage (code) {
  var r = fs.createReadStream(path.join(__dirname, 'usage.txt'))
  r.pipe(process.stdout)
  if (code) r.once('end', function () { process.exit(code) })
}

function fail (err) {
  console.error(err.message || err)
  process.exit(1)
}
