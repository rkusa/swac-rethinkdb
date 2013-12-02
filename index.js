var r = require('rethinkdb')

var API = function(model, opts, definition) {
  this.model = model
  this.opts  = opts || {}
  this.table = r.table(this.model._type)
  this.views = {}

  if (definition) definition.call(this)
}

API.prototype.initialize = function(callback) {
  var tableName = this.model._type
  var self = this
  this.connect(function(err, conn) {
    if (err) return callback(err)
    r.tableList().run(conn, function(err, tables) {
      if (err) return callback(err)
      if (!!~tables.indexOf(tableName)) {
        self.createIndexes(conn, callback)
        return
      }
      r.tableCreate(tableName).run(conn, function(err, res) {
        if (err) return callback(err)

        self.createIndexes(conn, callback)
      })
    })
  })
}

API.prototype.createIndexes = function(conn, callback) {
  var count = 1, self = this
  var cb = function(err) {
    if (--count === 0) callback()
  }

  this.model._definition.properties.forEach(function(key) {
    var index = self.model.prototype._validation[key].index
      , type  = self.model.prototype._validation[key].type
      , args  = [key]
    if (!index) return
    count++

    if (typeof index === 'function') {
      args.push(index)
    } else if (type === 'array') {
      args.push({ multi: true })
    }

    var table = r.table(self.model._type)
    table.indexCreate.apply(table, args)
         .run(conn, cb)
  })

  cb()
}

API.prototype.defineView = function(name, view) {
  this.views[name] = view
}

API.prototype.connect = function(callback) {
  callback = callback.bind(this)
  if (process.domain && 'rethinkdb' in process.domain) {
    return callback(null, process.domain.rethinkdb.conn)
  }
  r.connect(this.opts, function(err, conn) {
    if (err) return callback(err)
    if (process.domain) process.domain.rethinkdb = { conn: conn }
    callback(null, conn)
  })
}

API.prototype.get = function(id, callback) {
  if (!callback) callback = function() {}
  if (!id) return callback(null, null)

  this.connect(function(err, conn) {
    if (err) return callback(err)
    var self = this
    this.table.get(id).run(conn, function(err, body) {
      if (err) return callback(err)
      callback(null, body ? new self.model(body) : null)
    })
  })
}

API.prototype.put = function(doc, callback) {
  if (!callback) callback = function() {}

  var data = doc.toJSON(true)
  for (var key in data) {
    if (data[key] === undefined)
    delete data[key]
  }

  this.connect(function(err, conn) {
    if (err) return callback(err)
    this.table.get(doc.id).replace(data).run(conn, function(err, res) {
      if (err) return callback(err)
      callback(null, doc)
    })
  })
}

API.prototype.post = function(doc, callback) {
  if (!callback) callback = function() {}

  var data = doc.toJSON(true)
  for (var key in data) {
    if (data[key] === undefined)
    delete data[key]
  }

  this.connect(function(err, conn) {
    if (err) return callback(err)

    this.table.insert(data).run(conn, function(err, res) {
      if (err) return callback(err)
      if (!doc.id) doc.id = res.generated_keys[0]
      callback(null, doc)
    })
  })
}

API.prototype.delete = function(doc, callback) {
  if (!callback) callback = function() {}
  
  this.connect(function(err, conn) {
    if (err) return callback(err)
    this.table.get(doc.id).delete().run(conn, function(err) {
      if (err) return callback(err)
      callback(null)
    })
  })
}

API.prototype.view = function(/*view, key, query, callback*/) {
  var args = Array.prototype.slice.call(arguments)
    , callback = args.pop()
    , query = typeof args[args.length - 1] === 'object' ? args.pop() : {}
    , view = args.shift()
    , key = args.shift() || null


  if (view && !(view in this.views)) {
    throw new Error('View ' + view + ' for ' + this.model._type + ' does not exsist')
  }

  var self = this
  this.connect(function(err, conn) {
    if (err) return callback(err)
    var table = r.table(this.model._type, { useOutdated: this.opts.useOutdated || true })
      , context = { table: table, req: process.domain.req, conn: conn }
    var fn = view
      ? this.views[view].bind(context, key, query)
      : table.run.bind(table.orderBy(this.opts.orderBy || 'id'), conn)
    fn(function(err, rows) {
      if (err) return callback(err)
      if (!rows) {
        callback(null, null)
      } else if (Array.isArray(rows)) {
        callback(null, rows.map(function(row) {
          return row instanceof self.model ? row : new self.model(row)
        }))
      } else {
        callback(null, rows instanceof self.model ? rows : new self.model(rows))
      }
    })
  })
}

exports.initialize = function(model, opts, definition, callback) {
  var api = new API(model, opts, definition)
  api.initialize(callback)

  return api
}

exports.middleware = function() {
  return function(req, res, next) {
    function afterRequest() {
      res.removeListener('finish', afterRequest)
      res.removeListener('close', afterRequest)

      if (process.domain && 'rethinkdb' in process.domain) {
        process.domain.rethinkdb.conn.close()
        delete process.domain.rethinkdb
      }
    }

    res.on('finish', afterRequest)
    res.on('close', afterRequest)

    next()
  }
}