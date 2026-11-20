import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteMaterialRepository {
  constructor() {
    this.db = DatabaseConnection.getInstance();
    this._ensureTables();
  }

  _ensureTables() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS materiales_carpetas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          descripcion TEXT,
          color TEXT DEFAULT '#584294',
          icono TEXT DEFAULT 'folder',
          creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          es_publico INTEGER DEFAULT 1 CHECK (es_publico IN (0, 1)),
          activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();

      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS materiales_archivos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          carpeta_id INTEGER NOT NULL REFERENCES materiales_carpetas(id) ON DELETE CASCADE,
          nombre_original TEXT NOT NULL,
          nombre_almacenado TEXT NOT NULL,
          tipo_mime TEXT NOT NULL,
          tamano_bytes INTEGER NOT NULL,
          categoria TEXT DEFAULT 'FICHA_TRABAJO',
          descripcion TEXT,
          es_publico INTEGER DEFAULT 1 CHECK (es_publico IN (0, 1)),
          subido_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          descargas_count INTEGER DEFAULT 0,
          activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();

      try {
        this.db.prepare(`ALTER TABLE materiales_archivos ADD COLUMN es_publico INTEGER DEFAULT 1`).run();
      } catch (alterErr) {
        // La columna ya existe
      }
    } catch (e) {
      console.warn('Nota en verificación de tablas de materiales:', e.message);
    }
  }

  async getAllFolders(includeInactive = false, scope = 'public', userId = null) {
    let fileFilter = '';
    if (scope === 'public') {
      fileFilter = ' AND a.es_publico = 1';
    } else if (scope === 'private' && userId) {
      fileFilter = ` AND a.es_publico = 0 AND a.subido_por_usuario_id = ${Number(userId)}`;
    } else if (userId) {
      fileFilter = ` AND (a.es_publico = 1 OR a.subido_por_usuario_id = ${Number(userId)})`;
    }

    let sql = `
      SELECT 
        c.*,
        u.nombre_completo AS creador_nombre,
        (SELECT COUNT(*) FROM materiales_archivos a WHERE a.carpeta_id = c.id AND a.activo = 1 ${fileFilter}) AS total_archivos
      FROM materiales_carpetas c
      LEFT JOIN usuarios u ON c.creado_por_usuario_id = u.id
      WHERE 1=1
    `;
    if (!includeInactive) {
      sql += ` AND c.activo = 1`;
    }
    sql += ` ORDER BY c.id ASC`;
    return this.db.prepare(sql).all();
  }

  async getFolderById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        c.*,
        u.nombre_completo AS creador_nombre,
        (SELECT COUNT(*) FROM materiales_archivos a WHERE a.carpeta_id = c.id AND a.activo = 1) AS total_archivos
      FROM materiales_carpetas c
      LEFT JOIN usuarios u ON c.creado_por_usuario_id = u.id
      WHERE c.id = ? AND c.activo = 1
    `);
    return stmt.get(id) || null;
  }

  async createFolder({ nombre, descripcion, color = '#584294', icono = 'folder', creado_por_usuario_id, es_publico = 1 }) {
    const stmt = this.db.prepare(`
      INSERT INTO materiales_carpetas (nombre, descripcion, color, icono, creado_por_usuario_id, es_publico)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(nombre, descripcion, color, icono, creado_por_usuario_id, es_publico);
    return await this.getFolderById(res.lastInsertRowid);
  }

  async updateFolder(id, { nombre, descripcion, color, icono }) {
    const stmt = this.db.prepare(`
      UPDATE materiales_carpetas
      SET nombre = COALESCE(?, nombre),
          descripcion = COALESCE(?, descripcion),
          color = COALESCE(?, color),
          icono = COALESCE(?, icono),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(nombre, descripcion, color, icono, id);
    return await this.getFolderById(id);
  }

  async deleteFolder(id) {
    const stmt = this.db.prepare(`
      UPDATE materiales_carpetas
      SET activo = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id).changes > 0;
  }

  async getFilesByFolder(carpetaId, search = '', scope = 'public', userId = null) {
    let sql = `
      SELECT 
        a.*,
        u.nombre_completo AS subido_por_nombre,
        u.email AS subido_por_email
      FROM materiales_archivos a
      LEFT JOIN usuarios u ON a.subido_por_usuario_id = u.id
      WHERE a.carpeta_id = ? AND a.activo = 1
    `;
    const params = [carpetaId];

    if (scope === 'public') {
      sql += ` AND a.es_publico = 1`;
    } else if (scope === 'private' && userId) {
      sql += ` AND a.es_publico = 0 AND a.subido_por_usuario_id = ?`;
      params.push(userId);
    } else if (userId) {
      sql += ` AND (a.es_publico = 1 OR a.subido_por_usuario_id = ?)`;
      params.push(userId);
    }

    if (search && search.trim()) {
      sql += ` AND (a.nombre_original LIKE ? OR a.descripcion LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ` ORDER BY a.id DESC`;
    return this.db.prepare(sql).all(...params);
  }

  async getFileById(id) {
    const stmt = this.db.prepare(`
      SELECT a.*, c.nombre AS carpeta_nombre
      FROM materiales_archivos a
      JOIN materiales_carpetas c ON a.carpeta_id = c.id
      WHERE a.id = ? AND a.activo = 1
    `);
    return stmt.get(id) || null;
  }

  async createFile({ carpeta_id, nombre_original, nombre_almacenado, tipo_mime, tamano_bytes, categoria = 'FICHA_TRABAJO', descripcion = null, es_publico = 1, subido_por_usuario_id = null }) {
    const stmt = this.db.prepare(`
      INSERT INTO materiales_archivos (
        carpeta_id, nombre_original, nombre_almacenado, tipo_mime,
        tamano_bytes, categoria, descripcion, es_publico, subido_por_usuario_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      carpeta_id, nombre_original, nombre_almacenado, tipo_mime,
      tamano_bytes, categoria, descripcion, es_publico, subido_por_usuario_id
    );
    return await this.getFileById(res.lastInsertRowid);
  }

  async deleteFile(id) {
    const stmt = this.db.prepare(`
      UPDATE materiales_archivos
      SET activo = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id).changes > 0;
  }

  async incrementDownloads(id) {
    const stmt = this.db.prepare(`
      UPDATE materiales_archivos
      SET descargas_count = descargas_count + 1
      WHERE id = ?
    `);
    stmt.run(id);
  }
}
