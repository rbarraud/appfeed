# appfeed

version feed for trusted application delivery

# usage

```
appfeed generate

  Generate a keypair for signing application releases.

appfeed id

  Print the public key.

appfeed versions

  Print a list of versions with their hashes.

appfeed trusted
appfeed trusted REF

  Print a list of currently trusted nodes or if a version or hash REF
  is given, print the list of trusted nodes for REF.

appfeed show REF

  Print the contents of REF, a version or hash.

appfeed publish --version=VERSION

  Publish data from stdin as VERSION.

OPTIONS are:

  --dir -d      Where to save the appfeed data
  --keyfile -k  Use this keyfile. Default: ~/.config/appfeed/keys.json

```

# api

```
var appfeed = require('appfeed')
```

## var feed = appfeed(db, sodium, opts)

Instantiate a feed from a leveldb handle `db`,
a [sodium](https://npmjs.com/package/sodium) implementation,
and `opts`:

* `opts.secretKey` - sodium private key
* `opts.publicKey` - sodium public key
* `opts.store` - [abstract-blob-store](https://npmjs.com/package/abstract-blob-store)
implementation to store blobs

## var dup = feed.replicate(opts, cb)

Return a duplex stream to replicate with another appfeed.

* `opts.blobs` - when `false`, only replicate metadata, not blobs
* `opts.heads` - when `true`, only pull down the latest version of blobs
to save bandwidth

## var wstream = feed.publish(doc, cb)

Return a writable stream `wstream` to publish content for `doc`:

* `doc.version` - the version to publish this payload as.

`cb(err, doc)` fires with the `doc.key` of this release.

## feed.trust(id, cb)

Add trust for `id`.

## feed.revoke(id, cb)

Revoke trust in `id`.

## feed.trusted(from=null, cb)

Get an array of `ids` in `cb(err, ids)` which are trusted at `from`, or the
latest update if `from` is `null`.

# install

```
npm install -g appfeed
npm install appfeed
```

# thanks

Thanks to [blockai](https://blockai.com) for sponsoring this project.

# license

MIT
