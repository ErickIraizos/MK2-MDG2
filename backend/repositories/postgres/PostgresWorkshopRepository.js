import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresWorkshopRepository {
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
      params.push(tipo);
      query += ` AND t.tipo = $${params.length}`;
    }

    if (categoria && categoria !== 'TODOS') {
      params.push(`%${categoria}%`);
      query += ` AND t.categoria ILIKE $${params.length}`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      params.push(term);
      const pIdx = `$${params.length}`;
      query += ` AND (t.titulo ILIKE ${pIdx} OR t.subtitulo ILIKE ${pIdx} OR t.expositor_nombre ILIKE ${pIdx} OR t.temas_json ILIKE ${pIdx} OR tp.nombres ILIKE ${pIdx} OR tp.apellidos ILIKE ${pIdx})`;
    }

    query += ` ORDER BY t.destacado DESC, t.id DESC`;

    const { rows } = await PostgresConnection.query(query, params);
    return rows.map(r => this._formatRow(r));
  }

  async getWorkshopById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         t.*,
         tp.nombres AS terapeuta_nombres,
         tp.apellidos AS terapeuta_apellidos,
         tp.telefono AS terapeuta_telefono,
         tp.registro_profesional AS terapeuta_registro,
         tp.foto_url AS terapeuta_foto_url
       FROM talleres t
       LEFT JOIN terapeutas tp ON t.terapeuta_principal_id = tp.id
       WHERE t.id = $1`,
      [id]
    );
    return this._formatRow(rows[0]);
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

    const temasJson = Array.isArray(temas)
      ? JSON.stringify(temas)
      : (typeof temas === 'string' ? JSON.stringify(temas.split('\n').filter(Boolean).map(t => t.trim())) : '[]');

    const { rows } = await PostgresConnection.query(
      `INSERT INTO talleres (
         titulo, subtitulo, tipo, categoria, terapeuta_principal_id, expositor_nombre, expositor_cargo,
         telefono_contacto, fecha, hora, lugar, direccion, arancel, arancel_detalle,
         cupos_totales, cupos_ocupados, dirigido_a, temas_json, destacado, activo
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING id`,
      [
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
      ]
    );

    return this.getWorkshopById(rows[0].id);
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

    const temasJson = Array.isArray(temas)
      ? JSON.stringify(temas)
      : (typeof temas === 'string' ? JSON.stringify(temas.split('\n').filter(Boolean).map(t => t.trim())) : existing.temas_json);

    await PostgresConnection.query(
      `UPDATE talleres SET
         titulo = $1,
         subtitulo = $2,
         tipo = $3,
         categoria = $4,
         terapeuta_principal_id = $5,
         expositor_nombre = $6,
         expositor_cargo = $7,
         telefono_contacto = $8,
         fecha = $9,
         hora = $10,
         lugar = $11,
         direccion = $12,
         arancel = $13,
         arancel_detalle = $14,
         cupos_totales = $15,
         cupos_ocupados = $16,
         dirigido_a = $17,
         temas_json = $18,
         destacado = $19,
         activo = $20,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $21`,
      [
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
      ]
    );

    return this.getWorkshopById(id);
  }

  async toggleActivo(id, currentUser) {
    const existing = await this.getWorkshopById(id);
    if (!existing) return null;

    const nuevoEstado = existing.activo === 1 ? 0 : 1;
    await PostgresConnection.query(
      `UPDATE talleres SET activo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [nuevoEstado, id]
    );
    return this.getWorkshopById(id);
  }

  async deleteWorkshop(id, currentUser) {
    const res = await PostgresConnection.query(`DELETE FROM talleres WHERE id = $1`, [id]);
    return res.rowCount > 0;
  }

  async getStats() {
    const totalRes = await PostgresConnection.query(`SELECT COUNT(*)::int AS count FROM talleres`);
    const activosRes = await PostgresConnection.query(`SELECT COUNT(*)::int AS count FROM talleres WHERE activo = 1`);
    const cuposRes = await PostgresConnection.query(`SELECT COALESCE(SUM(cupos_totales), 0)::int AS totales, COALESCE(SUM(cupos_ocupados), 0)::int AS ocupados FROM talleres WHERE activo = 1`);
    const presRes = await PostgresConnection.query(`SELECT COUNT(*)::int AS count FROM talleres WHERE activo = 1 AND tipo = 'Presencial'`);
    const virtRes = await PostgresConnection.query(`SELECT COUNT(*)::int AS count FROM talleres WHERE activo = 1 AND tipo = 'Virtual'`);

    const total = totalRes.rows[0].count || 0;
    const activos = activosRes.rows[0].count || 0;

    return {
      total,
      activos,
      inactivos: total - activos,
      cuposTotales: cuposRes.rows[0].totales || 0,
      cuposOcupados: cuposRes.rows[0].ocupados || 0,
      presenciales: presRes.rows[0].count || 0,
      virtuales: virtRes.rows[0].count || 0
    };
  }
}
