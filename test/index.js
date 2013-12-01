var Model  = require('swac-odm').Model
  , expect = require('chai').expect
  , r      = require('rethinkdb')
  , conn, model

var DB_NAME = 'swac_test'

before(function(done) {
  r.connect({}, function(err, c) { 
    var domain = require('domain')
      , d = domain.create()
    d.req = {}
    d.enter()

    conn = c

    r.dbDrop(DB_NAME).run(conn, function(err) {
      r.dbCreate(DB_NAME).run(conn, function(err) {
        if (err) return done(err)
        conn.use(DB_NAME)
        done()
      })
    })
  })
})

// after(function(done) {
//   r.dbDrop(DB_NAME).run(conn, done)
// })

describe('SWAC RethinkDB Adapter', function() {
  describe('Model Definition', function() {
    before(function(done) {
      model = Model.define('models', function() {
        this.use(require('../'), { db: DB_NAME }, function() {
          this.defineView('byKey', function(key, query, callback) {
            this.table.getAll([this.req.user, key], { index: 'key' }).orderBy('id').run(this.conn, function(err, rows) {
              if (err) return callback(err)
              callback(null, rows)
            })
          })

          this.defineView('byUser', function(key, query, callback) {
            this.table.getAll(key, { index: 'user' }).orderBy('id').run(this.conn, function(err, rows) {
              if (err) return callback(err)
              callback(null, rows)
            })
          })

          this.defineView('byTag', function(key, query, callback) {
            this.table.getAll(key, { index: 'tags' }).orderBy('id').run(this.conn, function(err, rows) {
              if (err) return callback(err)
              callback(null, rows)
            })
          })
        })

        this.property('user', { index: true })
        this.property('key', { index: function(hero) {
          return [hero('user'), hero('key')]
        }})
        this.property('tags', { type: 'array', index: true })

        this.registerView('byUser')
        this.registerView('byKey')
        this.registerView('byTag')
      }, done)
    })
    it('should create the model\'s table', function(done) {
      r.tableList().run(conn, function(err, tables) {
        expect(err).to.not.exist
        expect(tables).to.include('models')
        done()
      })
    })
    it('should create the model\'s secondary indexes', function(done) {
      r.table(model._type).indexList().run(conn, function(err, indexes) {
        expect(err).to.not.exist
        expect(indexes).to.have.members(['user', 'key', 'tags'])
        done()
      })
    })
  })
  var cur, a, b, c
  describe('CRUD', function() {
    beforeEach(function() {
      delete process.domain.swac
    })
    it('POST should work', function(done) {
      model.post({ key: '1' }, function(err, row) {
        expect(err).to.not.exist
        cur = row
        r.table(model._type).get(row.id).run(conn, function(err, body) {
          if (err) throw err
          expect(body.key).to.equal(row.key)
          done()
        })
      })
    })
    it('PUT should work', function(done) {
      cur.key = '2'
      model.put(cur.id, cur, function(err, row) {
        expect(err).to.not.exist
        r.table(model._type).get(cur.id).run(conn, function(err, body) {
          expect(err).to.not.exist
          expect(body.key).to.equal(row.key)
          done()
        })
      })
    })
    it('GET should work', function(done) {
      model.get(cur.id, function(err, body) {
        expect(err).to.not.exist
        expect(body.id).to.equal(cur.id)
        expect(body.key).to.equal(cur.key)
        done()
      })
    })
    it('LIST should work', function(done) {
      model.post({ user: 1, key: 'A', tags: ['a', 'b'] }, function(err, row) {
        expect(err).to.not.exist
        a = row
        model.all(function(err, items) {
          if (err) throw err
          expect(items).to.have.lengthOf(2)
          done()
        })
      })
    })
    it('DELETE should work', function(done) {
      model.del(cur.id, function(err) {
        expect(err).to.not.exist
        r.table(model._type).get(cur.id).run(conn, function(err, body) {
          expect(err).to.not.exist
          expect(body).to.be.null
          done()
        })
      })
    })
  })
  describe('Views', function() {
    before(function(done) {
      model.post({ user: 2, key: 'B', tags: ['c'] }, function(err, row) {
        expect(err).to.not.exist
        b = row
        model.post({ user: 1, key: 'C', tags: ['a'] }, function(err, row) {
          expect(err).to.not.exist
          c = row
          done()
        })
      })
    })
    it('should work with simple indexes', function(done) {
      model.byUser(2, function(err, items) {
        expect(err).to.not.exist
        expect(items).to.have.lengthOf(1)
        expect(items[0].id).to.equal(b.id)
        done()
      })
    })
    it('should work with multi indexes', function(done) {
      model.byTag('a', function(err, items) {
        expect(err).to.not.exist
        expect(items).to.have.lengthOf(2)
        expect(items.map(function(item) { return item.id })).to.have.members([a.id, c.id])
        done()
      })
    })
    it('should work with function indexes', function(done) {
      process.domain.req.user = 1
      model.byKey('C', function(err, items) {
        expect(err).to.not.exist
        expect(items).to.have.lengthOf(1)
        expect(items[0].id).to.equal(c.id)
        done()
      })
    })
  })
})
