// PGlite-backed shim for node-postgres. Used in sandbox/dev only.
// Loaded via --require before any module that imports 'pg'.

const { PGlite } = require('@electric-sql/pglite');

let _db = null;
async function getDB() {
  if (_db) return _db;
  _db = new PGlite(); // in-memory
  return _db;
}

// PGlite's `query` returns { rows, fields, affectedRows } — node-postgres returns
// { rows, rowCount, fields, command }. We add rowCount and make it look right.

class PGliteClient {
  constructor(db) {
    this._db = db;
    this._inTx = false;
  }
  async query(sql, params) {
    if (params && !Array.isArray(params)) {
      // pg supports an object params form too; convert to array
      params = Object.values(params);
    }
    try {
      const result = await this._db.query(sql, params || []);
      // PGlite returns rows as objects with column → value
      return {
        rows: result.rows || [],
        rowCount: (result.rows || []).length,
        fields: (result.fields || []).map(f => ({ name: f.name, dataTypeID: f.dataTypeID })),
        command: (sql.trim().split(/\s+/)[0] || '').toUpperCase(),
      };
    } catch (e) {
      // Convert PGlite errors to look like pg errors
      const err = new Error(e.message || String(e));
      err.code = e.code;
      err.severity = e.severity;
      err.detail = e.detail;
      throw err;
    }
  }
  release() {
    // No-op for single-connection in-memory db
  }
}

class PGlitePool {
  constructor(opts = {}) {
    this._opts = opts;
    this._ready = null;
  }
  async _ensure() {
    if (!this._ready) this._ready = getDB();
    return this._ready;
  }
  async query(sql, params) {
    const db = await this._ensure();
    const client = new PGliteClient(db);
    return client.query(sql, params);
  }
  async connect() {
    const db = await this._ensure();
    return new PGliteClient(db);
  }
  on() { return this; }  // no-op event emitter stand-in
  off() { return this; }
  end() { /* no-op */ }
  addListener() { return this; }
  removeListener() { return this; }
  removeAllListeners() { return this; }
}

// Hijack the 'pg' module: register a Pool export.
const origResolve = require.resolve;
const origLoad = require.cache;

const pgModule = {
  Pool: PGlitePool,
  Client: PGliteClient,
  types: { getTypeParser: () => v => v },
};

require.cache[require.resolve('pg') || 'pg'] = {
  id: 'pg',
  filename: 'pg',
  loaded: true,
  exports: pgModule,
  children: [],
  paths: [],
};

// Better: monkey-patch Module._resolveFilename so require('pg') returns our shim
const Module = require('module');
const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request === 'pg') return 'pg-shim';
  return origResolveFilename.call(this, request, parent, ...rest);
};
require.cache['pg-shim'] = {
  id: 'pg-shim',
  filename: 'pg-shim',
  loaded: true,
  exports: pgModule,
  children: [],
  paths: [],
};
