/**
 * Database operations for IP pool management using sqlite-wasm
 */

import type { IPPool, IPPoolWithStats } from './ip-utils';

let db: any = null;

/**
 * Initialize the SQLite database
 */
export async function initDatabase() {
  if (db) return db;

  try {
    const sqlite3InitModule = await import('@sqlite.org/sqlite-wasm');
    const sqlite3 = await sqlite3InitModule.default();
    
    db = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS ip_pools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cidr TEXT NOT NULL UNIQUE,
        description TEXT,
        parent_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES ip_pools(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_parent_id ON ip_pools(parent_id);
      CREATE INDEX IF NOT EXISTS idx_cidr ON ip_pools(cidr);
    `);

    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get all IP pools
 */
export async function getAllPools(): Promise<IPPool[]> {
  const database = await initDatabase();
  const pools: IPPool[] = [];

  database.exec({
    sql: 'SELECT * FROM ip_pools ORDER BY created_at DESC',
    rowMode: 'object',
    callback: (row: any) => {
      pools.push({
        id: row.id,
        name: row.name,
        cidr: row.cidr,
        description: row.description,
        parentId: row.parent_id,
        createdAt: row.created_at,
      });
    },
  });

  return pools;
}

/**
 * Get pool by ID
 */
export async function getPoolById(id: number): Promise<IPPool | null> {
  const database = await initDatabase();
  let pool: IPPool | null = null;

  database.exec({
    sql: 'SELECT * FROM ip_pools WHERE id = ?',
    bind: [id],
    rowMode: 'object',
    callback: (row: any) => {
      pool = {
        id: row.id,
        name: row.name,
        cidr: row.cidr,
        description: row.description,
        parentId: row.parent_id,
        createdAt: row.created_at,
      };
    },
  });

  return pool;
}

/**
 * Get child pools of a parent
 */
export async function getChildPools(parentId: number | null): Promise<IPPool[]> {
  const database = await initDatabase();
  const pools: IPPool[] = [];

  const sql = parentId === null
    ? 'SELECT * FROM ip_pools WHERE parent_id IS NULL ORDER BY created_at DESC'
    : 'SELECT * FROM ip_pools WHERE parent_id = ? ORDER BY created_at DESC';

  database.exec({
    sql,
    bind: parentId === null ? [] : [parentId],
    rowMode: 'object',
    callback: (row: any) => {
      pools.push({
        id: row.id,
        name: row.name,
        cidr: row.cidr,
        description: row.description,
        parentId: row.parent_id,
        createdAt: row.created_at,
      });
    },
  });

  return pools;
}

/**
 * Create a new IP pool
 */
export async function createPool(pool: Omit<IPPool, 'id' | 'createdAt'>): Promise<number> {
  const database = await initDatabase();
  
  const stmt = database.prepare(
    'INSERT INTO ip_pools (name, cidr, description, parent_id) VALUES (?, ?, ?, ?)'
  );
  
  stmt.bind([
    pool.name,
    pool.cidr,
    pool.description || null,
    pool.parentId ?? null,
  ]);
  
  stmt.step();
  const id = database.changes() > 0 ? database.exec('SELECT last_insert_rowid() as id', {
    rowMode: 'object',
    returnValue: 'resultRows'
  })[0].id : -1;
  
  stmt.finalize();
  
  return id;
}

/**
 * Update an IP pool
 */
export async function updatePool(id: number, updates: Partial<IPPool>): Promise<boolean> {
  const database = await initDatabase();
  
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }

  if (fields.length === 0) return false;

  values.push(id);
  const sql = `UPDATE ip_pools SET ${fields.join(', ')} WHERE id = ?`;
  
  database.exec({
    sql,
    bind: values,
  });

  return database.changes() > 0;
}

/**
 * Delete an IP pool
 */
export async function deletePool(id: number): Promise<boolean> {
  const database = await initDatabase();
  
  database.exec({
    sql: 'DELETE FROM ip_pools WHERE id = ?',
    bind: [id],
  });

  return database.changes() > 0;
}

/**
 * Check if CIDR already exists
 */
export async function cidrExists(cidr: string, excludeId?: number): Promise<boolean> {
  const database = await initDatabase();
  let exists = false;

  const sql = excludeId
    ? 'SELECT COUNT(*) as count FROM ip_pools WHERE cidr = ? AND id != ?'
    : 'SELECT COUNT(*) as count FROM ip_pools WHERE cidr = ?';

  const bind = excludeId ? [cidr, excludeId] : [cidr];

  database.exec({
    sql,
    bind,
    rowMode: 'object',
    callback: (row: any) => {
      exists = row.count > 0;
    },
  });

  return exists;
}
