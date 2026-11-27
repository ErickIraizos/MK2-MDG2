import { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteUserRepository extends IUserRepository {
  constructor(db = DatabaseConnection.getInstance()) {
    super();
    this.db = db;
  }

  async findById(id) {
    const stmt = this.db.prepare(`
      SELECT u.id, u.nombre_completo, u.email, u.password_hash, u.rol_id, 
             u.telefono, u.activo, u.ultimo_acceso, u.created_at,
             u.firma_digital_blob, u.firma_actualizada_at, u.foto_url,
             r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.id = ?
    `);
    return stmt.get(id) || null;
  }

  async findByEmail(email) {
    const stmt = this.db.prepare(`
      SELECT u.id, u.nombre_completo, u.email, u.password_hash, u.rol_id, 
             u.telefono, u.activo, u.ultimo_acceso, u.created_at,
             u.firma_digital_blob, u.firma_actualizada_at, u.foto_url,
             r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.email = ? COLLATE NOCASE
    `);
    return stmt.get(email.trim()) || null;
  }

  async findAll(filters = {}) {
    let query = `
      SELECT u.id, u.nombre_completo, u.email, u.rol_id, u.telefono, u.activo, 
             u.ultimo_acceso, u.created_at, u.firma_digital_blob, u.firma_actualizada_at, u.foto_url,
             r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.rol) {
      query += ` AND r.nombre = ?`;
      params.push(filters.rol);
    }
    if (filters.activo !== undefined) {
      query += ` AND u.activo = ?`;
      params.push(filters.activo ? 1 : 0);
    }
    query += ` ORDER BY u.nombre_completo ASC`;

    return this.db.prepare(query).all(...params);
  }

  async create(userData) {
    const stmt = this.db.prepare(`
      INSERT INTO usuarios (nombre_completo, email, password_hash, rol_id, telefono, activo)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      userData.nombre_completo.trim(),
      userData.email.trim(),
      userData.password_hash,
      userData.rol_id,
      userData.telefono || null,
      userData.activo !== undefined ? (userData.activo ? 1 : 0) : 1
    );
    return this.findById(info.lastInsertRowid);
  }

  async updatePassword(id, newPasswordHash) {
    const stmt = this.db.prepare(`
      UPDATE usuarios 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(newPasswordHash, id);
    return true;
  }

  async updateLastAccess(id) {
    const stmt = this.db.prepare(`
      UPDATE usuarios 
      SET ultimo_acceso = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
    return true;
  }

  async updateRole(id, roleId) {
    const stmt = this.db.prepare(`
      UPDATE usuarios 
      SET rol_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(roleId, id);
    return this.findById(id);
  }

  async update(id, data) {
    const fields = [];
    const params = [];

    if (data.nombre_completo !== undefined) {
      fields.push('nombre_completo = ?');
      params.push(data.nombre_completo);
    }
    if (data.telefono !== undefined) {
      fields.push('telefono = ?');
      params.push(data.telefono);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      params.push(data.email);
    }
    if (data.firma_digital_blob !== undefined) {
      fields.push('firma_digital_blob = ?');
      params.push(data.firma_digital_blob);
    }
    if (data.firma_actualizada_at !== undefined) {
      fields.push('firma_actualizada_at = ?');
      params.push(data.firma_actualizada_at);
    }
    if (data.foto_url !== undefined) {
      fields.push('foto_url = ?');
      params.push(data.foto_url);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const stmt = this.db.prepare(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return this.findById(id);
  }

  async updateStatus(id, activo) {
    const stmt = this.db.prepare(`
      UPDATE usuarios 
      SET activo = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(activo ? 1 : 0, id);
    return this.findById(id);
  }

  async delete(id, motivo = 'Desvinculación del centro', desvinculadoPorId = null) {
    const stmt = this.db.prepare(`
      UPDATE usuarios 
      SET activo = 0, 
          fecha_desvinculacion = datetime('now', 'localtime'),
          motivo_desvinculacion = ?,
          desvinculado_por_id = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const info = stmt.run(motivo, desvinculadoPorId, id);

    try {
      this.db.prepare(`UPDATE terapeutas SET activo = 0 WHERE usuario_id = ?`).run(id);
    } catch (e) {
      // Ignorar si no aplica
    }

    return info.changes > 0;
  }

  async restore(id) {
    const stmt = this.db.prepare(`
      UPDATE usuarios 
      SET activo = 1, 
          fecha_desvinculacion = NULL,
          motivo_desvinculacion = NULL,
          desvinculado_por_id = NULL,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const info = stmt.run(id);

    try {
      this.db.prepare(`UPDATE terapeutas SET activo = 1 WHERE usuario_id = ?`).run(id);
    } catch (e) {
      // Ignorar si no aplica
    }

    return info.changes > 0;
  }

  async getInactiveUsers() {
    const stmt = this.db.prepare(`
      SELECT u.id, u.nombre_completo, u.email, u.telefono, u.activo, u.rol_id,
             u.fecha_desvinculacion, u.motivo_desvinculacion, u.desvinculado_por_id,
             r.nombre AS rol_nombre,
             d.nombre_completo AS desvinculado_por_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN usuarios d ON u.desvinculado_por_id = d.id
      WHERE u.activo = 0
      ORDER BY u.fecha_desvinculacion DESC
    `);
    return stmt.all();
  }

  async logAudit(userId, accion, modulo, detalles, ip) {
    let nombreSnapshot = null;
    let emailSnapshot = null;
    let rolSnapshot = null;

    if (userId) {
      try {
        const user = this.db.prepare(`
          SELECT u.nombre_completo, u.email, r.nombre AS rol_nombre 
          FROM usuarios u 
          LEFT JOIN roles r ON u.rol_id = r.id 
          WHERE u.id = ?
        `).get(userId);
        if (user) {
          nombreSnapshot = user.nombre_completo;
          emailSnapshot = user.email;
          rolSnapshot = user.rol_nombre;
        }
      } catch (err) {
        // Proceder
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO bitacora_auditoria (
        usuario_id, usuario_nombre_snapshot, usuario_email_snapshot, rol_nombre_snapshot,
        accion, modulo, detalles, ip_origen
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      userId || null,
      nombreSnapshot,
      emailSnapshot,
      rolSnapshot,
      accion,
      modulo,
      typeof detalles === 'object' ? JSON.stringify(detalles) : detalles,
      ip || null
    );
    return true;
  }

  async getAuditLogs(limit = 100) {
    const stmt = this.db.prepare(`
      SELECT b.id, b.usuario_id, b.accion, b.modulo, b.detalles, b.ip_origen, b.created_at,
             COALESCE(b.usuario_nombre_snapshot, u.nombre_completo, 'Usuario Desvinculado') AS usuario_nombre,
             COALESCE(b.usuario_email_snapshot, u.email, '-') AS usuario_email,
             COALESCE(b.rol_nombre_snapshot, r.nombre, 'Sin Rol') AS rol_nombre,
             u.activo AS usuario_activo
      FROM bitacora_auditoria b
      LEFT JOIN usuarios u ON b.usuario_id = u.id
      LEFT JOIN roles r ON u.rol_id = r.id
      ORDER BY b.created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
}
