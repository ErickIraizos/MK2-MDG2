import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteConvenioRepository {
  constructor() {
    this.db = DatabaseConnection.getInstance();
    this._ensureSchema();
  }

  _ensureSchema() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS convenios_institucionales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre_institucion TEXT NOT NULL,
          tipo_institucion TEXT NOT NULL,
          descripcion_convenio TEXT NOT NULL,
          beneficio_familias TEXT,
          imagen_url TEXT,
          telefono_contacto TEXT,
          email_contacto TEXT,
          direccion TEXT,
          sitio_web TEXT,
          destacado INTEGER DEFAULT 0 CHECK (destacado IN (0, 1)),
          activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
          orden INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();

      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_convenios_activo ON convenios_institucionales(activo)`).run();
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_convenios_tipo ON convenios_institucionales(tipo_institucion)`).run();
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_convenios_destacado ON convenios_institucionales(destacado)`).run();
    } catch (e) {
      console.warn('[ConvenioRepository] Aviso al asegurar esquema:', e.message);
    }
  }

  async getAllConvenios(filters = {}) {
    const { search, tipo, soloActivos = true } = filters;
    let query = `SELECT * FROM convenios_institucionales WHERE 1=1`;
    const params = [];

    if (soloActivos) {
      query += ` AND activo = 1`;
    }

    if (tipo && tipo !== 'TODOS') {
      query += ` AND tipo_institucion = ?`;
      params.push(tipo);
    }

    if (search && search.trim()) {
      query += ` AND (nombre_institucion LIKE ? OR descripcion_convenio LIKE ? OR beneficio_familias LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY destacado DESC, orden ASC, created_at DESC`;

    return this.db.prepare(query).all(...params);
  }

  async getConvenioById(id) {
    return this.db.prepare('SELECT * FROM convenios_institucionales WHERE id = ?').get(id);
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

    const stmt = this.db.prepare(`
      INSERT INTO convenios_institucionales (
        nombre_institucion, tipo_institucion, descripcion_convenio, beneficio_familias,
        imagen_url, telefono_contacto, email_contacto, direccion, sitio_web,
        destacado, activo, orden
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
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
    );

    const newId = result.lastInsertRowid;

    // Registrar en auditoría
    try {
      this._logAudit(currentUser, 'CREAR_CONVENIO', `Registró el convenio institucional #${newId} con "${nombre_institucion}"`);
    } catch (e) {
      console.warn('[ConvenioRepository] Error al auditar creación:', e.message);
    }

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

    const stmt = this.db.prepare(`
      UPDATE convenios_institucionales
      SET nombre_institucion = ?,
          tipo_institucion = ?,
          descripcion_convenio = ?,
          beneficio_familias = ?,
          imagen_url = ?,
          telefono_contacto = ?,
          email_contacto = ?,
          direccion = ?,
          sitio_web = ?,
          destacado = ?,
          activo = ?,
          orden = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
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
    );

    // Auditoría
    try {
      this._logAudit(currentUser, 'ACTUALIZAR_CONVENIO', `Actualizó el convenio institucional #${id} ("${nombre_institucion}")`);
    } catch (e) {
      console.warn('[ConvenioRepository] Error al auditar actualización:', e.message);
    }

    return this.getConvenioById(id);
  }

  async toggleActivo(id, currentUser) {
    const existing = await this.getConvenioById(id);
    if (!existing) return null;

    const nuevoEstado = existing.activo === 1 ? 0 : 1;
    this.db.prepare('UPDATE convenios_institucionales SET activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nuevoEstado, id);

    try {
      this._logAudit(currentUser, 'CAMBIAR_ESTADO_CONVENIO', `Cambió estado de convenio #${id} a ${nuevoEstado === 1 ? 'ACTIVO' : 'INACTIVO'}`);
    } catch (e) {}

    return this.getConvenioById(id);
  }

  async deleteConvenio(id, currentUser) {
    const existing = await this.getConvenioById(id);
    if (!existing) return false;

    this.db.prepare('DELETE FROM convenios_institucionales WHERE id = ?').run(id);

    try {
      this._logAudit(currentUser, 'ELIMINAR_CONVENIO', `Eliminó el convenio institucional #${id} ("${existing.nombre_institucion}")`);
    } catch (e) {}

    return true;
  }

  async getStats() {
    const total = this.db.prepare('SELECT count(*) as count FROM convenios_institucionales').get().count;
    const activos = this.db.prepare('SELECT count(*) as count FROM convenios_institucionales WHERE activo = 1').get().count;
    const destacados = this.db.prepare('SELECT count(*) as count FROM convenios_institucionales WHERE destacado = 1 AND activo = 1').get().count;
    const porTipo = this.db.prepare(`
      SELECT tipo_institucion as tipo, count(*) as count
      FROM convenios_institucionales
      WHERE activo = 1
      GROUP BY tipo_institucion
      ORDER BY count DESC
    `).all();

    return { total, activos, inactivos: total - activos, destacados, porTipo };
  }

  _logAudit(currentUser, accion, detalles) {
    if (!currentUser || !currentUser.id) return;
    try {
      this.db.prepare(`
        INSERT INTO bitacora_auditoria (
          usuario_id, usuario_nombre_snapshot, usuario_email_snapshot, rol_nombre_snapshot,
          accion, modulo, detalles
        ) VALUES (?, ?, ?, ?, ?, 'CONVENIOS_INSTITUCIONALES', ?)
      `).run(
        currentUser.id,
        currentUser.nombre_completo || 'Usuario',
        currentUser.email || '',
        currentUser.rol || 'ADMIN',
        accion,
        detalles
      );
    } catch (e) {
      console.warn('[ConvenioRepository] Aviso bitácora:', e.message);
    }
  }
}
