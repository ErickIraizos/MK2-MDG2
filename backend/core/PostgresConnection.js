import pg from 'pg';
import { config } from '../config/environment.js';
import { getBoliviaNowSqlString, INSTITUTIONAL_TIMEZONE } from '../utils/dateTime.js';

const { Pool, types } = pg;

// Parsear tipos de PostgreSQL para mantener paridad exacta con SQLite/JS
// 20 = INT8 (COUNT(*), SUM), 1700 = NUMERIC (REAL/DECIMAL), 1082 = DATE, 1114 = TIMESTAMP, 1184 = TIMESTAMPTZ
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
types.setTypeParser(1082, (val) => (val === null ? null : String(val).slice(0, 10)));
types.setTypeParser(1114, (val) => (val === null ? null : String(val).replace('T', ' ').slice(0, 19)));
types.setTypeParser(1184, (val) => {
  if (val === null) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return getBoliviaNowSqlString(d);
});

let poolInstance = null;
const initializedClients = new WeakSet();

async function ensureClientTimezone(client) {
  if (!initializedClients.has(client)) {
    await client.query(`SET TIME ZONE '${INSTITUTIONAL_TIMEZONE}'`);
    initializedClients.add(client);
  }
}

export class PostgresConnection {
  /**
   * Retorna el pool singleton de PostgreSQL (Session Pooler en EC2).
   */
  static getPool() {
    if (!poolInstance) {
      const connectionString = config.database.postgresUrl;
      if (!connectionString) {
        throw new Error('[Postgres] DIRECT_URL o DATABASE_URL no está configurado en el entorno.');
      }

      const useSsl = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');

      poolInstance = new Pool({
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 15,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000
      });

      poolInstance.on('error', (err) => {
        console.error('[Postgres] Error inesperado en cliente inactivo del pool:', err.message);
      });

      console.log(`[Database] Pool PostgreSQL inicializado (Zona Horaria: ${INSTITUTIONAL_TIMEZONE})`);
    }
    return poolInstance;
  }

  /**
   * Ejecuta una consulta simple garantizando zona horaria America/La_Paz en la sesión física.
   */
  static async query(sql, params = []) {
    const pool = PostgresConnection.getPool();
    const client = await pool.connect();
    try {
      await ensureClientTimezone(client);
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  /**
   * Ejecuta una función dentro de una transacción atómica sobre un mismo PoolClient.
   * Garantiza zona horaria America/La_Paz, BEGIN / COMMIT / ROLLBACK y liberación segura del cliente.
   */
  static async transaction(callback, { isolationLevel = 'READ COMMITTED' } = {}) {
    const pool = PostgresConnection.getPool();
    const client = await pool.connect();
    try {
      await ensureClientTimezone(client);
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('[Postgres] Error ejecutando ROLLBACK:', rbErr.message);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Adquiere un bloqueo transaccional exclusivo (equivalente a BEGIN IMMEDIATE por recurso)
   * usando pg_advisory_xact_lock(namespaceInt, resourceInt). Se libera automáticamente en COMMIT/ROLLBACK.
   */
  static async advisoryLock(client, namespaceInt, resourceInt = 0) {
    await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', [
      Number(namespaceInt) || 0,
      Number(resourceInt) || 0
    ]);
  }

  /**
   * Verifica la conectividad real al arrancar el servidor.
   */
  static async verifyConnection() {
    const res = await PostgresConnection.query('SELECT current_database() AS db, NOW() AS now, current_setting(\'TIMEZONE\') AS tz');
    return res.rows[0];
  }

  static async close() {
    if (poolInstance) {
      await poolInstance.end();
      poolInstance = null;
      console.log('[Database] Pool PostgreSQL cerrado.');
    }
  }
}
