import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteGlossaryRepository {
  constructor() {
    this.db = DatabaseConnection.getInstance();
    this._ensureSchema();
  }

  _ensureSchema() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS glosario_terminos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          subtitle TEXT NOT NULL,
          category TEXT NOT NULL,
          category_name TEXT NOT NULL,
          que_es TEXT NOT NULL,
          aplicacion TEXT NOT NULL,
          ejemplo TEXT NOT NULL,
          autor TEXT DEFAULT 'Equipo PSI Aprende',
          orden INTEGER DEFAULT 0,
          activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();

      // Verificar y agregar columna activo si la tabla ya existía previamente
      const cols = this.db.prepare("PRAGMA table_info(glosario_terminos)").all();
      if (!cols.some(c => c.name === 'activo')) {
        this.db.prepare("ALTER TABLE glosario_terminos ADD COLUMN activo INTEGER DEFAULT 1").run();
      }

      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_glosario_category ON glosario_terminos(category)`).run();
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_glosario_title ON glosario_terminos(title)`).run();
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_glosario_activo ON glosario_terminos(activo)`).run();
    } catch (e) {
      console.warn('[GlossaryRepository] Aviso al asegurar esquema:', e.message);
    }
  }

  async getAllTerms(filters = {}) {
    const { category, search, status, userRole } = filters;
    let query = `SELECT * FROM glosario_terminos WHERE 1=1`;
    const params = [];

    // Control de visibilidad: Sólo ADMIN puede ver inactivos si lo solicita o en modo general
    if (userRole === 'ADMIN') {
      if (status === 'INACTIVE' || status === '0') {
        query += ` AND activo = 0`;
      } else if (status === 'ACTIVE' || status === '1') {
        query += ` AND activo = 1`;
      }
      // Si status es 'ALL', muestra tanto activos como inactivos
    } else {
      // Terapeutas, Recepción y Tutores sólo pueden ver términos activos
      query += ` AND activo = 1`;
    }

    if (category && category !== 'ALL') {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (search && search.trim()) {
      query += ` AND (title LIKE ? OR subtitle LIKE ? OR que_es LIKE ? OR aplicacion LIKE ? OR ejemplo LIKE ? OR category_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    query += ` ORDER BY orden ASC, title ASC`;
    return this.db.prepare(query).all(...params);
  }

  async getTermById(id) {
    return this.db.prepare(`SELECT * FROM glosario_terminos WHERE id = ?`).get(id);
  }

  async getTermByTitle(title) {
    return this.db.prepare(`SELECT * FROM glosario_terminos WHERE LOWER(title) = LOWER(?)`).get(title);
  }

  async createTerm(data) {
    const stmt = this.db.prepare(`
      INSERT INTO glosario_terminos (
        title, subtitle, category, category_name, que_es, aplicacion, ejemplo, autor, orden, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      data.title.trim(),
      data.subtitle ? data.subtitle.trim() : '',
      data.category,
      data.category_name || data.category,
      data.que_es.trim(),
      data.aplicacion.trim(),
      data.ejemplo ? data.ejemplo.trim() : '',
      data.autor || 'Equipo PSI Aprende',
      data.orden || 0
    );

    return this.getTermById(result.lastInsertRowid);
  }

  async updateTerm(id, data) {
    const stmt = this.db.prepare(`
      UPDATE glosario_terminos SET
        title = COALESCE(?, title),
        subtitle = COALESCE(?, subtitle),
        category = COALESCE(?, category),
        category_name = COALESCE(?, category_name),
        que_es = COALESCE(?, que_es),
        aplicacion = COALESCE(?, aplicacion),
        ejemplo = COALESCE(?, ejemplo),
        autor = COALESCE(?, autor),
        orden = COALESCE(?, orden),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      data.title ? data.title.trim() : null,
      data.subtitle ? data.subtitle.trim() : null,
      data.category || null,
      data.category_name || null,
      data.que_es ? data.que_es.trim() : null,
      data.aplicacion ? data.aplicacion.trim() : null,
      data.ejemplo ? data.ejemplo.trim() : null,
      data.autor || null,
      data.orden !== undefined ? data.orden : null,
      id
    );

    return this.getTermById(id);
  }

  async setTermStatus(id, activo) {
    this.db.prepare(`
      UPDATE glosario_terminos SET
        activo = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(activo ? 1 : 0, id);

    return this.getTermById(id);
  }

  // Protección anti-eliminación accidental: soft-delete que pasa a inactivo
  async deleteTerm(id) {
    return this.setTermStatus(id, 0);
  }
}

