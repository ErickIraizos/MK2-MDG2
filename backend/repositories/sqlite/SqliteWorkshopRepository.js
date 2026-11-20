import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteWorkshopRepository {
  constructor() {
    this.db = DatabaseConnection.getInstance();
    this._ensureSchema();
  }

  _ensureSchema() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS talleres (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          titulo TEXT NOT NULL,
          subtitulo TEXT,
          tipo TEXT NOT NULL DEFAULT 'Presencial' CHECK (tipo IN ('Presencial', 'Virtual')),
          categoria TEXT NOT NULL DEFAULT 'Padres',
          terapeuta_principal_id INTEGER REFERENCES terapeutas(id) ON DELETE SET NULL,
          expositor_nombre TEXT,
          expositor_cargo TEXT,
          telefono_contacto TEXT,
          fecha TEXT NOT NULL,
          hora TEXT NOT NULL,
          lugar TEXT NOT NULL,
          direccion TEXT,
          arancel TEXT NOT NULL DEFAULT '50 Bs',
          arancel_detalle TEXT,
          cupos_totales INTEGER NOT NULL DEFAULT 15,
          cupos_ocupados INTEGER NOT NULL DEFAULT 0,
          dirigido_a TEXT,
          temas_json TEXT,
          activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
          destacado INTEGER DEFAULT 0 CHECK (destacado IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();

      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_talleres_activo ON talleres(activo)`).run();
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_talleres_terapeuta ON talleres(terapeuta_principal_id)`).run();
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_talleres_tipo ON talleres(tipo)`).run();
    } catch (e) {
      console.warn('[WorkshopRepository] Aviso al asegurar esquema:', e.message);
    }
  }

  _formatRow(row) {
    if (!row) return null;
    let temas = [];
    if (row.temas_json) {
      try {
        temas = JSON.parse(row.temas_json);
      } catch (err) {
        temas = [row.temas_json];
      }
    }
    const finalPhone = row.telefono_contacto || row.terapeuta_telefono || '';
    const expositorDisplay = row.expositor_nombre || (row.terapeuta_nombres ? `Lic. ${row.terapeuta_nombres} ${row.terapeuta_apellidos}` : 'Equipo Multidisciplinario PSI Aprende');

    return {
      ...row,
      temas,
      telefono_final: finalPhone,
      expositor_display: expositorDisplay
    };
  }

  async getAllWorkshops(filters = {}) {
    const { search, tipo, categoria, soloActivos = true } = filters;
    let query = `
      SELECT 
        t.*,
        tp.nombres AS terapeuta_nombres,
        tp.apellidos AS terapeuta_apellidos,
        tp.telefono AS terapeuta_telefono,
        tp.registro_profesional AS terapeuta_registro,
        tp.foto_url AS terapeuta_foto_url
      FROM talleres t
      LEFT JOIN terapeutas tp ON t.terapeuta_principal_id = tp.id
      WHERE 1=1
    `;
    const params = [];

    if (soloActivos) {
      query += ` AND t.activo = 1`;
    }

    if (tipo && tipo !== 'TODOS') {
      query += ` AND t.tipo = ?`;
      params.push(tipo);
    }

    if (categoria && categoria !== 'TODOS') {
      query += ` AND t.categoria LIKE ?`;
      params.push(`%${categoria}%`);
    }

    if (search && search.trim()) {
      query += ` AND (t.titulo LIKE ? OR t.subtitulo LIKE ? OR t.expositor_nombre LIKE ? OR t.temas_json LIKE ? OR tp.nombres LIKE ? OR tp.apellidos LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    query += ` ORDER BY t.destacado DESC, t.id DESC`;

    const rows = this.db.prepare(query).all(...params);
    return rows.map(r => this._formatRow(r));
  }

  async getWorkshopById(id) {
    const query = `
      SELECT 
        t.*,
        tp.nombres AS terapeuta_nombres,
        tp.apellidos AS terapeuta_apellidos,
        tp.telefono AS terapeuta_telefono,
        tp.registro_profesional AS terapeuta_registro,
        tp.foto_url AS terapeuta_foto_url
      FROM talleres t
      LEFT JOIN terapeutas tp ON t.terapeuta_principal_id = tp.id
      WHERE t.id = ?
    `;
    const row = this.db.prepare(query).get(id);
    return this._formatRow(row);
  }

  async createWorkshop(data, currentUser) {
    const {
      titulo,
      subtitulo = null,
      tipo = 'Presencial',
      categoria = 'Padres',
      terapeuta_principal_id = null,
      expositor_nombre = null,
      expositor_cargo = null,
      telefono_contacto = null,
      fecha,
      hora,
      lugar,
      direccion = null,
      arancel = '50 Bs',
      arancel_detalle = null,
      cupos_totales = 15,
      cupos_ocupados = 0,
      dirigido_a = null,
      temas = [],
      destacado = 0,
      activo = 1
    } = data;

    const temasJson = Array.isArray(temas) ? JSON.stringify(temas) : (typeof temas === 'string' ? JSON.stringify(temas.split('\n').filter(Boolean).map(t => t.trim())) : '[]');

    const stmt = this.db.prepare(`
      INSERT INTO talleres (
        titulo, subtitulo, tipo, categoria, terapeuta_principal_id, expositor_nombre, expositor_cargo,
        telefono_contacto, fecha, hora, lugar, direccion, arancel, arancel_detalle,
        cupos_totales, cupos_ocupados, dirigido_a, temas_json, destacado, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      titulo.trim(),
      subtitulo ? subtitulo.trim() : null,
      tipo,
      categoria,
      terapeuta_principal_id ? Number(terapeuta_principal_id) : null,
      expositor_nombre ? expositor_nombre.trim() : null,
      expositor_cargo ? expositor_cargo.trim() : null,
      telefono_contacto ? telefono_contacto.trim() : null,
      fecha.trim(),
      hora.trim(),
      lugar.trim(),
      direccion ? direccion.trim() : null,
      arancel.trim(),
      arancel_detalle ? arancel_detalle.trim() : null,
      Number(cupos_totales) || 15,
      Number(cupos_ocupados) || 0,
      dirigido_a ? dirigido_a.trim() : null,
      temasJson,
      destacado ? 1 : 0,
      activo !== undefined ? (activo ? 1 : 0) : 1
    );

    return this.getWorkshopById(result.lastInsertRowid);
  }

  async updateWorkshop(id, data, currentUser) {
    const existing = await this.getWorkshopById(id);
    if (!existing) return null;

    const {
      titulo = existing.titulo,
      subtitulo = existing.subtitulo,
      tipo = existing.tipo,
      categoria = existing.categoria,
      terapeuta_principal_id = existing.terapeuta_principal_id,
      expositor_nombre = existing.expositor_nombre,
      expositor_cargo = existing.expositor_cargo,
      telefono_contacto = existing.telefono_contacto,
      fecha = existing.fecha,
      hora = existing.hora,
      lugar = existing.lugar,
      direccion = existing.direccion,
      arancel = existing.arancel,
      arancel_detalle = existing.arancel_detalle,
      cupos_totales = existing.cupos_totales,
      cupos_ocupados = existing.cupos_ocupados,
      dirigido_a = existing.dirigido_a,
      temas = existing.temas,
      destacado = existing.destacado,
      activo = existing.activo
    } = data;

    const temasJson = Array.isArray(temas) ? JSON.stringify(temas) : (typeof temas === 'string' ? JSON.stringify(temas.split('\n').filter(Boolean).map(t => t.trim())) : existing.temas_json);

    const stmt = this.db.prepare(`
      UPDATE talleres SET
        titulo = ?,
        subtitulo = ?,
        tipo = ?,
        categoria = ?,
        terapeuta_principal_id = ?,
        expositor_nombre = ?,
        expositor_cargo = ?,
        telefono_contacto = ?,
        fecha = ?,
        hora = ?,
        lugar = ?,
        direccion = ?,
        arancel = ?,
        arancel_detalle = ?,
        cupos_totales = ?,
        cupos_ocupados = ?,
        dirigido_a = ?,
        temas_json = ?,
        destacado = ?,
        activo = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      titulo.trim(),
      subtitulo ? subtitulo.trim() : null,
      tipo,
      categoria,
      terapeuta_principal_id ? Number(terapeuta_principal_id) : null,
      expositor_nombre ? expositor_nombre.trim() : null,
      expositor_cargo ? expositor_cargo.trim() : null,
      telefono_contacto ? telefono_contacto.trim() : null,
      fecha.trim(),
      hora.trim(),
      lugar.trim(),
      direccion ? direccion.trim() : null,
      arancel.trim(),
      arancel_detalle ? arancel_detalle.trim() : null,
      Number(cupos_totales),
      Number(cupos_ocupados),
      dirigido_a ? dirigido_a.trim() : null,
      temasJson,
      destacado ? 1 : 0,
      activo ? 1 : 0,
      id
    );

    return this.getWorkshopById(id);
  }

  async toggleActivo(id, currentUser) {
    const existing = await this.getWorkshopById(id);
    if (!existing) return null;

    const nuevoEstado = existing.activo === 1 ? 0 : 1;
    this.db.prepare(`UPDATE talleres SET activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(nuevoEstado, id);
    return this.getWorkshopById(id);
  }

  async deleteWorkshop(id, currentUser) {
    const result = this.db.prepare(`DELETE FROM talleres WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  async getStats() {
    const totalRow = this.db.prepare(`SELECT COUNT(*) as count FROM talleres`).get();
    const activosRow = this.db.prepare(`SELECT COUNT(*) as count FROM talleres WHERE activo = 1`).get();
    const cuposRow = this.db.prepare(`SELECT SUM(cupos_totales) as totales, SUM(cupos_ocupados) as ocupados FROM talleres WHERE activo = 1`).get();
    const presencialesRow = this.db.prepare(`SELECT COUNT(*) as count FROM talleres WHERE activo = 1 AND tipo = 'Presencial'`).get();
    const virtualesRow = this.db.prepare(`SELECT COUNT(*) as count FROM talleres WHERE activo = 1 AND tipo = 'Virtual'`).get();

    return {
      total: totalRow.count || 0,
      activos: activosRow.count || 0,
      inactivos: (totalRow.count || 0) - (activosRow.count || 0),
      cuposTotales: cuposRow.totales || 0,
      cuposOcupados: cuposRow.ocupados || 0,
      presenciales: presencialesRow.count || 0,
      virtuales: virtualesRow.count || 0
    };
  }
}
