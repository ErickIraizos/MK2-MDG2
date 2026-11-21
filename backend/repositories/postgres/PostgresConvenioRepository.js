import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresConvenioRepository {
  async getAllConvenios(filters = {}) {
    const { search, tipo, soloActivos = true } = filters;
    let query = `SELECT * FROM convenios_institucionales WHERE 1=1`;
    const params = [];

    if (soloActivos) {
      query += ` AND activo = 1`;
    }

    if (tipo && tipo !== 'TODOS') {
      params.push(tipo);
      query += ` AND tipo_institucion = $${params.length}`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      params.push(term);
      const pIdx = `$${params.length}`;
      query += ` AND (nombre_institucion ILIKE ${pIdx} OR descripcion_convenio ILIKE ${pIdx} OR beneficio_familias ILIKE ${pIdx})`;
    }

    query += ` ORDER BY destacado DESC, orden ASC, created_at DESC`;

    const { rows } = await PostgresConnection.query(query, params);
    return rows;
  }

  async getConvenioById(id) {
    const { rows } = await PostgresConnection.query(
      'SELECT * FROM convenios_institucionales WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }

  async createConvenio(data, currentUser) {
    const {
      nombre_institucion,
      tipo_institucion,
      descripcion_convenio,
      beneficio_familias = null,
      imagen_url = null,
      telefono_contacto = null,
      email_contacto = null,
      direccion = null,
      sitio_web = null,
      destacado = 0,
      activo = 1,
      orden = 0
    } = data;

    const { rows } = await PostgresConnection.query(
      `INSERT INTO convenios_institucionales (
         nombre_institucion, tipo_institucion, descripcion_convenio, beneficio_familias,
         imagen_url, telefono_contacto, email_contacto, direccion, sitio_web,
         destacado, activo, orden
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        nombre_institucion.trim(),
        tipo_institucion,
        descripcion_convenio.trim(),
        beneficio_familias ? beneficio_familias.trim() : null,
        imagen_url || null,
        telefono_contacto ? telefono_contacto.trim() : null,
        email_contacto ? email_contacto.trim() : null,
        direccion ? direccion.trim() : null,
        sitio_web ? sitio_web.trim() : null,
        destacado ? 1 : 0,
        activo !== undefined ? (activo ? 1 : 0) : 1,
        Number(orden) || 0
      ]
    );

    const newId = rows[0].id;
    await this._logAudit(currentUser, 'CREAR_CONVENIO', `Registró el convenio institucional #${newId} con "${nombre_institucion}"`);
    return this.getConvenioById(newId);
  }

  async updateConvenio(id, data, currentUser) {
    const existing = await this.getConvenioById(id);
    if (!existing) return null;

    const {
      nombre_institucion = existing.nombre_institucion,
      tipo_institucion = existing.tipo_institucion,
      descripcion_convenio = existing.descripcion_convenio,
      beneficio_familias = existing.beneficio_familias,
      imagen_url = existing.imagen_url,
      telefono_contacto = existing.telefono_contacto,
      email_contacto = existing.email_contacto,
      direccion = existing.direccion,
      sitio_web = existing.sitio_web,
      destacado = existing.destacado,
      activo = existing.activo,
      orden = existing.orden
    } = data;

    await PostgresConnection.query(
      `UPDATE convenios_institucionales
       SET nombre_institucion = $1,
           tipo_institucion = $2,
           descripcion_convenio = $3,
           beneficio_familias = $4,
           imagen_url = $5,
           telefono_contacto = $6,
           email_contacto = $7,
           direccion = $8,
           sitio_web = $9,
           destacado = $10,
           activo = $11,
           orden = $12,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $13`,
      [
        nombre_institucion.trim(),
        tipo_institucion,
        descripcion_convenio.trim(),
        beneficio_familias ? beneficio_familias.trim() : null,
        imagen_url || null,
        telefono_contacto ? telefono_contacto.trim() : null,
        email_contacto ? email_contacto.trim() : null,
        direccion ? direccion.trim() : null,
        sitio_web ? sitio_web.trim() : null,
        destacado ? 1 : 0,
        activo ? 1 : 0,
        Number(orden) || 0,
        id
      ]
    );

    await this._logAudit(currentUser, 'ACTUALIZAR_CONVENIO', `Actualizó el convenio institucional #${id} ("${nombre_institucion}")`);
    return this.getConvenioById(id);
  }

  async toggleActivo(id, currentUser) {
    const existing = await this.getConvenioById(id);
    if (!existing) return null;

    const nuevoEstado = existing.activo === 1 ? 0 : 1;
    await PostgresConnection.query(
      'UPDATE convenios_institucionales SET activo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [nuevoEstado, id]
    );

    await this._logAudit(currentUser, 'CAMBIAR_ESTADO_CONVENIO', `Cambió estado de convenio #${id} a ${nuevoEstado === 1 ? 'ACTIVO' : 'INACTIVO'}`);
    return this.getConvenioById(id);
  }

  async deleteConvenio(id, currentUser) {
    const existing = await this.getConvenioById(id);
    if (!existing) return false;

    await PostgresConnection.query('DELETE FROM convenios_institucionales WHERE id = $1', [id]);
    await this._logAudit(currentUser, 'ELIMINAR_CONVENIO', `Eliminó el convenio institucional #${id} ("${existing.nombre_institucion}")`);
    return true;
  }

  async getStats() {
    const totalRes = await PostgresConnection.query('SELECT COUNT(*)::int AS count FROM convenios_institucionales');
    const activosRes = await PostgresConnection.query('SELECT COUNT(*)::int AS count FROM convenios_institucionales WHERE activo = 1');
    const destRes = await PostgresConnection.query('SELECT COUNT(*)::int AS count FROM convenios_institucionales WHERE destacado = 1 AND activo = 1');
    const porTipoRes = await PostgresConnection.query(
      `SELECT tipo_institucion AS tipo, COUNT(*)::int AS count
       FROM convenios_institucionales
       WHERE activo = 1
       GROUP BY tipo_institucion
       ORDER BY count DESC`
    );

    const total = totalRes.rows[0].count;
    const activos = activosRes.rows[0].count;
    const destacados = destRes.rows[0].count;

    return { total, activos, inactivos: total - activos, destacados, porTipo: porTipoRes.rows };
  }

  async _logAudit(currentUser, accion, detalles) {
    if (!currentUser || !currentUser.id) return;
    try {
      await PostgresConnection.query(
        `INSERT INTO bitacora_auditoria (
           usuario_id, usuario_nombre_snapshot, usuario_email_snapshot, rol_nombre_snapshot,
           accion, modulo, detalles
         ) VALUES ($1, $2, $3, $4, $5, 'CONVENIOS_INSTITUCIONALES', $6)`,
        [
          currentUser.id,
          currentUser.nombre_completo || 'Usuario',
          currentUser.email || '',
          currentUser.rol || 'ADMIN',
          accion,
          detalles
        ]
      );
    } catch (e) {
      console.warn('[PostgresConvenioRepository] Aviso bitácora:', e.message);
    }
  }
}
