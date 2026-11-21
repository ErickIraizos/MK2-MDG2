import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresMaterialRepository {
  async getAllFolders(includeInactive = false, scope = 'public', userId = null) {
    const params = [];
    let fileFilter = '';

    if (scope === 'public') {
      fileFilter = ' AND a.es_publico = 1';
    } else if (scope === 'private' && userId) {
      params.push(Number(userId));
      fileFilter = ` AND a.es_publico = 0 AND a.subido_por_usuario_id = $${params.length}`;
    } else if (userId) {
      params.push(Number(userId));
      fileFilter = ` AND (a.es_publico = 1 OR a.subido_por_usuario_id = $${params.length})`;
    }

    let sql = `
      SELECT
        c.*,
        u.nombre_completo AS creador_nombre,
        (SELECT COUNT(*)::int FROM materiales_archivos a WHERE a.carpeta_id = c.id AND a.activo = 1 ${fileFilter}) AS total_archivos
      FROM materiales_carpetas c
      LEFT JOIN usuarios u ON c.creado_por_usuario_id = u.id
      WHERE 1=1
    `;
    if (!includeInactive) {
      sql += ` AND c.activo = 1`;
    }
    sql += ` ORDER BY c.id ASC`;

    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

  async getFolderById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         c.*,
         u.nombre_completo AS creador_nombre,
         (SELECT COUNT(*)::int FROM materiales_archivos a WHERE a.carpeta_id = c.id AND a.activo = 1) AS total_archivos
       FROM materiales_carpetas c
       LEFT JOIN usuarios u ON c.creado_por_usuario_id = u.id
       WHERE c.id = $1 AND c.activo = 1`,
      [id]
    );
    return rows[0] || null;
  }

  async createFolder({ nombre, descripcion, color = '#584294', icono = 'folder', creado_por_usuario_id, es_publico = 1 }) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO materiales_carpetas (nombre, descripcion, color, icono, creado_por_usuario_id, es_publico)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [nombre, descripcion, color, icono, creado_por_usuario_id, es_publico]
    );
    return this.getFolderById(rows[0].id);
  }

  async updateFolder(id, { nombre, descripcion, color, icono }) {
    await PostgresConnection.query(
      `UPDATE materiales_carpetas
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           color = COALESCE($3, color),
           icono = COALESCE($4, icono),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [nombre ?? null, descripcion ?? null, color ?? null, icono ?? null, id]
    );
    return this.getFolderById(id);
  }

  async deleteFolder(id) {
    const res = await PostgresConnection.query(
      `UPDATE materiales_carpetas
       SET activo = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
    return res.rowCount > 0;
  }

  async getFilesByFolder(carpetaId, search = '', scope = 'public', userId = null) {
    let sql = `
      SELECT
        a.*,
        u.nombre_completo AS subido_por_nombre,
        u.email AS subido_por_email
      FROM materiales_archivos a
      LEFT JOIN usuarios u ON a.subido_por_usuario_id = u.id
      WHERE a.carpeta_id = $1 AND a.activo = 1
    `;
    const params = [carpetaId];

    if (scope === 'public') {
      sql += ` AND a.es_publico = 1`;
    } else if (scope === 'private' && userId) {
      params.push(userId);
      sql += ` AND a.es_publico = 0 AND a.subido_por_usuario_id = $${params.length}`;
    } else if (userId) {
      params.push(userId);
      sql += ` AND (a.es_publico = 1 OR a.subido_por_usuario_id = $${params.length})`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = `$${params.length}`;
      sql += ` AND (a.nombre_original ILIKE ${pIdx} OR a.descripcion ILIKE ${pIdx})`;
    }

    sql += ` ORDER BY a.id DESC`;
    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

  async getFileById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT a.*, c.nombre AS carpeta_nombre
       FROM materiales_archivos a
       JOIN materiales_carpetas c ON a.carpeta_id = c.id
       WHERE a.id = $1 AND a.activo = 1`,
      [id]
    );
    return rows[0] || null;
  }

  async createFile({ carpeta_id, nombre_original, nombre_almacenado, tipo_mime, tamano_bytes, categoria = 'FICHA_TRABAJO', descripcion = null, es_publico = 1, subido_por_usuario_id = null }) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO materiales_archivos (
         carpeta_id, nombre_original, nombre_almacenado, tipo_mime,
         tamano_bytes, categoria, descripcion, es_publico, subido_por_usuario_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        carpeta_id, nombre_original, nombre_almacenado, tipo_mime,
        tamano_bytes, categoria, descripcion, es_publico, subido_por_usuario_id
      ]
    );
    return this.getFileById(rows[0].id);
  }

  async deleteFile(id) {
    const res = await PostgresConnection.query(
      `UPDATE materiales_archivos
       SET activo = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
    return res.rowCount > 0;
  }

  async incrementDownloads(id) {
    await PostgresConnection.query(
      `UPDATE materiales_archivos
       SET descargas_count = descargas_count + 1
       WHERE id = $1`,
      [id]
    );
  }
}
