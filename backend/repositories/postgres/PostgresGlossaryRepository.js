import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresGlossaryRepository {
  async getAllTerms(filters = {}) {
    const { category, search, status, userRole } = filters;
    let query = `SELECT * FROM glosario_terminos WHERE 1=1`;
    const params = [];

    if (userRole === 'ADMIN') {
      if (status === 'INACTIVE' || status === '0') {
        query += ` AND activo = 0`;
      } else if (status === 'ACTIVE' || status === '1') {
        query += ` AND activo = 1`;
      }
    } else {
      query += ` AND activo = 1`;
    }

    if (category && category !== 'ALL') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      params.push(term);
      const pIdx = `$${params.length}`;
      query += ` AND (title ILIKE ${pIdx} OR subtitle ILIKE ${pIdx} OR que_es ILIKE ${pIdx} OR aplicacion ILIKE ${pIdx} OR ejemplo ILIKE ${pIdx} OR category_name ILIKE ${pIdx})`;
    }

    query += ` ORDER BY orden ASC, title ASC`;
    const { rows } = await PostgresConnection.query(query, params);
    return rows;
  }

  async getTermById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT * FROM glosario_terminos WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async getTermByTitle(title) {
    const { rows } = await PostgresConnection.query(
      `SELECT * FROM glosario_terminos WHERE LOWER(title) = LOWER($1)`,
      [title]
    );
    return rows[0] || null;
  }

  async createTerm(data) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO glosario_terminos (
         title, subtitle, category, category_name, que_es, aplicacion, ejemplo, autor, orden, activo
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
       RETURNING id`,
      [
        data.title.trim(),
        data.subtitle ? data.subtitle.trim() : '',
        data.category,
        data.category_name || data.category,
        data.que_es.trim(),
        data.aplicacion.trim(),
        data.ejemplo ? data.ejemplo.trim() : '',
        data.autor || 'Equipo PSI Aprende',
        data.orden || 0
      ]
    );

    return this.getTermById(rows[0].id);
  }

  async updateTerm(id, data) {
    await PostgresConnection.query(
      `UPDATE glosario_terminos SET
         title = COALESCE($1, title),
         subtitle = COALESCE($2, subtitle),
         category = COALESCE($3, category),
         category_name = COALESCE($4, category_name),
         que_es = COALESCE($5, que_es),
         aplicacion = COALESCE($6, aplicacion),
         ejemplo = COALESCE($7, ejemplo),
         autor = COALESCE($8, autor),
         orden = COALESCE($9, orden),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $10`,
      [
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
      ]
    );

    return this.getTermById(id);
  }

  async setTermStatus(id, activo) {
    await PostgresConnection.query(
      `UPDATE glosario_terminos SET activo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [activo ? 1 : 0, id]
    );
    return this.getTermById(id);
  }

  async deleteTerm(id) {
    return this.setTermStatus(id, 0);
  }
}
