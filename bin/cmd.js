#!/usr/bin/env node
var minimist = require('minimist')
var path = require('path')
var fs = require('fs')

var argv = minimist(process.argv.slice(2), {
  alias: { h: 'help' }
})
if (argv.help || argv._[0] === 'help') return usage(0)

var fromArgs = require('./args.js')
if (fromArgs(process.argv.slice(2)) === false) usage(1)

function usage (code) {
  var r = fs.createReadStream(path.join(__dirname, 'usage.txt'))
  r.pipe(process.stdout)
  if (code) r.once('end', function () { process.exit(code) })
}
