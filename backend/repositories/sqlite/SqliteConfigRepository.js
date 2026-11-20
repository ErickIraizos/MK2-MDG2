import { IConfigRepository } from '../../domain/interfaces/IConfigRepository.js';
import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteConfigRepository extends IConfigRepository {
  constructor(db = DatabaseConnection.getInstance()) {
    super();
    this.db = db;
  }

  async getByKey(key) {
    const stmt = this.db.prepare(`
      SELECT clave, valor, descripcion, categoria, es_secreto, updated_at
      FROM configuraciones_sistema
      WHERE clave = ? COLLATE NOCASE
    `);
    const row = stmt.get(key.trim());
    return row ? row.valor : null;
  }

  async getAll(includeSecrets = false) {
    const stmt = this.db.prepare(`
      SELECT id, clave, valor, descripcion, categoria, es_secreto, updated_at
      FROM configuraciones_sistema
      ORDER BY categoria ASC, clave ASC
    `);
    const rows = stmt.all();

    return rows.map(r => {
      // Si es secreto y no se solicita explícitamente, enmascarar
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
    const stmt = this.db.prepare(`
      INSERT INTO configuraciones_sistema (clave, valor, updated_at, updated_by)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(clave) DO UPDATE SET
        valor = excluded.valor,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = excluded.updated_by
    `);
    stmt.run(key.trim(), String(value).trim(), updatedBy);
    return true;
  }

  async setMultiple(keyValueMap, updatedBy = null) {
    const transaction = this.db.transaction((entries) => {
      const stmt = this.db.prepare(`
        INSERT INTO configuraciones_sistema (clave, valor, updated_at, updated_by)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(clave) DO UPDATE SET
          valor = excluded.valor,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = excluded.updated_by
      `);
      for (const [k, v] of Object.entries(entries)) {
        stmt.run(k.trim(), String(v).trim(), updatedBy);
      }
    });

    transaction(keyValueMap);
    return true;
  }
}
