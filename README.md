# [SWAC-ODM](https://github.com/rkusa/swac-odm) RethinkDB Adapter
[![NPM](https://badge.fury.io/js/swac-rethinkdb.png)](https://npmjs.org/package/swac-rethinkdb)
[![Build Status](https://secure.travis-ci.org/rkusa/swac-rethinkdb.png)](http://travis-ci.org/rkusa/swac-rethinkdb) [![Dependency Status](https://gemnasium.com/rkusa/swac-rethinkdb.png)](https://gemnasium.com/rkusa/swac-rethinkdb)

## Usage

```js
this.use('rethinkdb', { db: 'name' }, function() {
  // definition
})
```

### Options

* **db** - the database name the model instances should be saved in
* **host** - the host to connect to (default localhost)
* **port** - the port to connect on (default 28015)
* **authKey** - the authentication key (default none)
* **orderBy** - default key the results are ordered by (default id)
* **useOutdated** - whether or not outdated reads are OK (default: false)

## Indexes

To create an index, set the `index` option for the property of the model accordingly.

```js
var Model = require('swac-odm').Model
Model.define('models', function() {
  // this will create a simple index
  this.property('user', { index: true })

  // this will create a index using the provided function
  this.property('key', { index: function(hero) {
    return [hero('user'), hero('key')]
  }})

  // this will create an multi index
  this.property('tags', { type: 'array', index: true })
})
```

## Definition API

The definitions context provides the following methods:

### .defineView(name, fn)

**Arguments:**

* **name** - the view's name
* **fn** - a function which will be executed once the view got called

**Context:**

* **this.table** - the rethink table object, can be chained with other [commands](http://www.rethinkdb.com/api/javascript)
* **this.conn** - the current connect to the database
* **this.req** - the current request object

**Example:**

```js
this.use('rethinkdb', function() {
  this.defineView('byUser', function(key, query, callback) {
    this.defineView('byKey', function(key, query, callback) {
      this.table.getAll([this.req.user, key], { index: 'key' }).orderBy('id')
      .run(this.conn, function(err, rows) {
        if (err) return callback(err)
        callback(null, rows)
      })
    })
  })
})
```

## MIT License
Copyright (c) 2013 Markus Ast

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.