import { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresUserRepository extends IUserRepository {
  async findById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT u.id, u.nombre_completo, u.email, u.password_hash, u.rol_id,
              u.telefono, u.activo, u.ultimo_acceso, u.created_at,
              u.firma_digital_blob, u.firma_actualizada_at, u.foto_url,
              r.nombre AS rol_nombre
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async findByEmail(email) {
    const { rows } = await PostgresConnection.query(
      `SELECT u.id, u.nombre_completo, u.email, u.password_hash, u.rol_id,
              u.telefono, u.activo, u.ultimo_acceso, u.created_at,
              u.firma_digital_blob, u.firma_actualizada_at, u.foto_url,
              r.nombre AS rol_nombre
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [String(email || '').trim()]
    );
    return rows[0] || null;
  }

  async findAll(filters = {}) {
    let query = `
      SELECT u.id, u.nombre_completo, u.email, u.rol_id, u.telefono, u.activo,
             u.ultimo_acceso, u.created_at, u.firma_digital_blob, u.firma_actualizada_at, u.foto_url,
             r.nombre AS rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.rol) {
      params.push(filters.rol);
      query += ` AND r.nombre = $${params.length}`;
    }
    if (filters.activo !== undefined) {
      params.push(filters.activo ? 1 : 0);
      query += ` AND u.activo = $${params.length}`;
    }
    query += ` ORDER BY u.nombre_completo ASC`;

    const { rows } = await PostgresConnection.query(query, params);
    return rows;
  }

  async create(userData) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO usuarios (nombre_completo, email, password_hash, rol_id, telefono, activo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        userData.nombre_completo.trim(),
        userData.email.trim(),
        userData.password_hash,
        userData.rol_id,
        userData.telefono || null,
        userData.activo !== undefined ? (userData.activo ? 1 : 0) : 1
      ]
    );
    return this.findById(rows[0].id);
  }

  async updatePassword(id, newPasswordHash) {
    await PostgresConnection.query(
      `UPDATE usuarios SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newPasswordHash, id]
    );
    return true;
  }

  async updateLastAccess(id) {
    await PostgresConnection.query(
      `UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    return true;
  }

  async updateRole(id, roleId) {
    await PostgresConnection.query(
      `UPDATE usuarios SET rol_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [roleId, id]
    );
    return this.findById(id);
  }

  async update(id, data) {
    const fields = [];
    const params = [];

    if (data.nombre_completo !== undefined) {
      params.push(data.nombre_completo);
      fields.push(`nombre_completo = $${params.length}`);
    }
    if (data.telefono !== undefined) {
      params.push(data.telefono);
      fields.push(`telefono = $${params.length}`);
    }
    if (data.email !== undefined) {
      params.push(data.email);
      fields.push(`email = $${params.length}`);
    }
    if (data.firma_digital_blob !== undefined) {
      params.push(data.firma_digital_blob);
      fields.push(`firma_digital_blob = $${params.length}`);
    }
    if (data.firma_actualizada_at !== undefined) {
      params.push(data.firma_actualizada_at);
      fields.push(`firma_actualizada_at = $${params.length}`);
    }
    if (data.foto_url !== undefined) {
      params.push(data.foto_url);
      fields.push(`foto_url = $${params.length}`);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await PostgresConnection.query(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${params.length}`,
      params
    );
    return this.findById(id);
  }

  async updateStatus(id, activo) {
    await PostgresConnection.query(
      `UPDATE usuarios SET activo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [activo ? 1 : 0, id]
    );
    return this.findById(id);
  }

  async delete(id, motivo = 'Desvinculación del centro', desvinculadoPorId = null) {
    const res = await PostgresConnection.query(
      `UPDATE usuarios
       SET activo = 0,
           fecha_desvinculacion = CURRENT_TIMESTAMP,
           motivo_desvinculacion = $1,
           desvinculado_por_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [motivo, desvinculadoPorId, id]
    );

    try {
      await PostgresConnection.query(`UPDATE terapeutas SET activo = 0 WHERE usuario_id = $1`, [id]);
    } catch (e) {
      // Ignorar si no aplica
    }

    return res.rowCount > 0;
  }

  async restore(id) {
    const res = await PostgresConnection.query(
      `UPDATE usuarios
       SET activo = 1,
           fecha_desvinculacion = NULL,
           motivo_desvinculacion = NULL,
           desvinculado_por_id = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    try {
      await PostgresConnection.query(`UPDATE terapeutas SET activo = 1 WHERE usuario_id = $1`, [id]);
    } catch (e) {
      // Ignorar si no aplica
    }

    return res.rowCount > 0;
  }

  async getInactiveUsers() {
    const { rows } = await PostgresConnection.query(
      `SELECT u.id, u.nombre_completo, u.email, u.telefono, u.activo, u.rol_id,
              u.fecha_desvinculacion, u.motivo_desvinculacion, u.desvinculado_por_id,
              r.nombre AS rol_nombre,
              d.nombre_completo AS desvinculado_por_nombre
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       LEFT JOIN usuarios d ON u.desvinculado_por_id = d.id
       WHERE u.activo = 0
       ORDER BY u.fecha_desvinculacion DESC`
    );
    return rows;
  }

  async logAudit(userId, accion, modulo, detalles, ip) {
    let nombreSnapshot = null;
    let emailSnapshot = null;
    let rolSnapshot = null;

    if (userId) {
      try {
        const { rows } = await PostgresConnection.query(
          `SELECT u.nombre_completo, u.email, r.nombre AS rol_nombre
           FROM usuarios u
           LEFT JOIN roles r ON u.rol_id = r.id
           WHERE u.id = $1`,
          [userId]
        );
        if (rows[0]) {
          nombreSnapshot = rows[0].nombre_completo;
          emailSnapshot = rows[0].email;
          rolSnapshot = rows[0].rol_nombre;
        }
      } catch (err) {
        // Proceder
      }
    }

    await PostgresConnection.query(
      `INSERT INTO bitacora_auditoria (
         usuario_id, usuario_nombre_snapshot, usuario_email_snapshot, rol_nombre_snapshot,
         accion, modulo, detalles, ip_origen
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId || null,
        nombreSnapshot,
        emailSnapshot,
        rolSnapshot,
        accion,
        modulo,
        typeof detalles === 'object' ? JSON.stringify(detalles) : detalles,
        ip || null
      ]
    );
    return true;
  }

  async getAuditLogs(limit = 100) {
    const { rows } = await PostgresConnection.query(
      `SELECT b.id, b.usuario_id, b.accion, b.modulo, b.detalles, b.ip_origen, b.created_at,
              COALESCE(b.usuario_nombre_snapshot, u.nombre_completo, 'Usuario Desvinculado') AS usuario_nombre,
              COALESCE(b.usuario_email_snapshot, u.email, '-') AS usuario_email,
              COALESCE(b.rol_nombre_snapshot, r.nombre, 'Sin Rol') AS rol_nombre,
              u.activo AS usuario_activo
       FROM bitacora_auditoria b
       LEFT JOIN usuarios u ON b.usuario_id = u.id
       LEFT JOIN roles r ON u.rol_id = r.id
       ORDER BY b.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }
}
