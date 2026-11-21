import { IConfigRepository } from '../../domain/interfaces/IConfigRepository.js';
import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresConfigRepository extends IConfigRepository {
  async getByKey(key) {
    const { rows } = await PostgresConnection.query(
      `SELECT clave, valor, descripcion, categoria, es_secreto, updated_at
       FROM configuraciones_sistema
       WHERE LOWER(clave) = LOWER($1)`,
      [String(key || '').trim()]
    );
    return rows[0] ? rows[0].valor : null;
  }

  async getAll(includeSecrets = false) {
    const { rows } = await PostgresConnection.query(
      `SELECT id, clave, valor, descripcion, categoria, es_secreto, updated_at
       FROM configuraciones_sistema
       ORDER BY categoria ASC, clave ASC`
    );

    return rows.map(r => {
      if (r.es_secreto === 1 && !includeSecrets) {
        return {
          ...r,
          valor: r.valor ? `${r.valor.substring(0, 4)}••••••••${r.valor.substring(r.valor.length - 4)}` : ''
        };
      }
      return r;
    });
  }

  async setKey(key, value, updatedBy = null) {
    await PostgresConnection.query(
      `INSERT INTO configuraciones_sistema (clave, valor, updated_at, updated_by)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
       ON CONFLICT (clave) DO UPDATE SET
         valor = EXCLUDED.valor,
         updated_at = CURRENT_TIMESTAMP,
         updated_by = EXCLUDED.updated_by`,
      [key.trim(), String(value).trim(), updatedBy]
    );
    return true;
  }

  async setMultiple(keyValueMap, updatedBy = null) {
    await PostgresConnection.transaction(async (client) => {
      const sql = `
        INSERT INTO configuraciones_sistema (clave, valor, updated_at, updated_by)
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
        ON CONFLICT (clave) DO UPDATE SET
          valor = EXCLUDED.valor,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = EXCLUDED.updated_by
      `;
      for (const [k, v] of Object.entries(keyValueMap)) {
        await client.query(sql, [k.trim(), String(v).trim(), updatedBy]);
      }
    });
    return true;
  }
}
