#!/usr/bin/env node
var minimist = require('minimist')
var path = require('path')
var fs = require('fs')

var argv = minimist(process.argv.slice(2), {
  default: { dir: path.join(process.cwd(), 'appfeed') },
  alias: { d: 'dir' }
})
if (argv.help || argv._[0] === 'help') return usage(0)

var appfeed = require('../')
var sodium = require('sodium')
var blobs = require('content-addressable-blob-store')
var mkdirp = require('mkdirp')

var dbdir = path.join(argv.dir, 'db')
var blobdir = path.join(argv.dir, 'blob')
var keyfile = path.join(argv.dir, 'keys.json')
mkdirp.sync(dbdir)
mkdirp.sync(blobdir)

var feed = appfeed(dbdir, sodium, {
  store: blobs(blobdir),
  publicKey: 
})

if (argv._[0] === 'generate') {
  /// ...
} else if (argv._[0] === 'server') {
  // ...
} else if (argv._[0] === 'publish') {
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
