import { ITherapistRepository } from '../../domain/interfaces/ITherapistRepository.js';
import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresTherapistRepository extends ITherapistRepository {
  async findById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT t.*,
              e.nombre AS especialidad_nombre, e.color AS especialidad_color,
              a.codigo AS ambiente_codigo, a.nombre AS ambiente_nombre,
              u.email AS usuario_email
       FROM terapeutas t
       LEFT JOIN especialidades e ON t.especialidad_id = e.id
       LEFT JOIN ambientes a ON t.ambiente_preferido_id = a.id
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async findByUserId(userId) {
    const { rows } = await PostgresConnection.query(
      `SELECT t.*,
              e.nombre AS especialidad_nombre, e.color AS especialidad_color,
              a.codigo AS ambiente_codigo, a.nombre AS ambiente_nombre
       FROM terapeutas t
       LEFT JOIN especialidades e ON t.especialidad_id = e.id
       LEFT JOIN ambientes a ON t.ambiente_preferido_id = a.id
       WHERE t.usuario_id = $1`,
      [userId]
    );
    return rows[0] || null;
  }

  async findAll(includeInactive = false) {
    let query = `
      SELECT t.*,
             e.nombre AS especialidad_nombre, e.color AS especialidad_color,
             a.codigo AS ambiente_codigo, a.nombre AS ambiente_nombre,
             u.email AS usuario_email
      FROM terapeutas t
      LEFT JOIN especialidades e ON t.especialidad_id = e.id
      LEFT JOIN ambientes a ON t.ambiente_preferido_id = a.id
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE 1=1
    `;
    if (!includeInactive) {
      query += ` AND t.activo = 1`;
    }
    query += ` ORDER BY t.id ASC`;

    const { rows } = await PostgresConnection.query(query);
    return rows;
  }

  async create(therapistData) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO terapeutas (
         usuario_id, nombres, apellidos, registro_profesional,
         especialidad_id, ambiente_preferido_id, telefono,
         porcentaje_honorarios, color_agenda, bio, turnos_atencion,
         foto_url, titulos_academicos, diplomados_certificaciones,
         experiencia_anios, enfoque_terapeutico, activo
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [
        therapistData.usuario_id || null,
        therapistData.nombres.trim(),
        therapistData.apellidos.trim(),
        therapistData.registro_profesional.trim().toUpperCase(),
        therapistData.especialidad_id || null,
        therapistData.ambiente_preferido_id || null,
        therapistData.telefono ? therapistData.telefono.trim() : null,
        therapistData.porcentaje_honorarios !== undefined ? therapistData.porcentaje_honorarios : 70.00,
        therapistData.color_agenda || '#7c3aed',
        therapistData.bio || null,
        therapistData.turnos_atencion || 'MAÑANA_TARDE',
        therapistData.foto_url || null,
        therapistData.titulos_academicos || null,
        therapistData.diplomados_certificaciones || null,
        therapistData.experiencia_anios || null,
        therapistData.enfoque_terapeutico || null,
        therapistData.activo !== undefined ? (therapistData.activo ? 1 : 0) : 1
      ]
    );
    return this.findById(rows[0].id);
  }

  async update(id, therapistData) {
    const fields = [];
    const params = [];

    const allowed = [
      'nombres', 'apellidos', 'registro_profesional', 'especialidad_id',
      'ambiente_preferido_id', 'telefono', 'porcentaje_honorarios',
      'color_agenda', 'bio', 'turnos_atencion', 'firma_digital_blob',
      'firma_actualizada_at', 'qr_cobro_url', 'banco_nombre',
      'cuenta_numero', 'cuenta_titular', 'arancel_base_bob', 'qr_fecha_vencimiento',
      'foto_url', 'titulos_academicos', 'diplomados_certificaciones',
      'experiencia_anios', 'enfoque_terapeutico', 'activo'
    ];

    for (const key of allowed) {
      if (therapistData[key] !== undefined) {
        params.push(therapistData[key]);
        fields.push(`${key} = $${params.length}`);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await PostgresConnection.query(
      `UPDATE terapeutas SET ${fields.join(', ')} WHERE id = $${params.length}`,
      params
    );

    return this.findById(id);
  }

  async deleteLogical(id) {
    await PostgresConnection.query(
      `UPDATE terapeutas SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    return true;
  }

  async getSpecialties() {
    const { rows } = await PostgresConnection.query(
      `SELECT * FROM especialidades WHERE activo = 1 ORDER BY id ASC`
    );
    return rows;
  }

  async getTherapistTariffs(therapistId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         sa.id AS servicio_id,
         sa.nombre AS servicio_nombre,
         sa.descripcion AS servicio_descripcion,
         sa.duracion_minutos,
         sa.arancel_bob AS arancel_base_clinica,
         COALESCE(tsp.arancel_bob, sa.arancel_bob) AS arancel_terapeuta_bob
       FROM servicios_aranceles sa
       LEFT JOIN terapeutas_servicios_precios tsp
         ON sa.id = tsp.servicio_id AND tsp.terapeuta_id = $1
       WHERE sa.activo = 1
       ORDER BY sa.id ASC`,
      [therapistId]
    );
    return rows;
  }

  async saveTherapistTariffs(therapistId, tariffs = []) {
    await PostgresConnection.transaction(async (client) => {
      const sql = `
        INSERT INTO terapeutas_servicios_precios (terapeuta_id, servicio_id, arancel_bob, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (terapeuta_id, servicio_id) DO UPDATE SET
          arancel_bob = EXCLUDED.arancel_bob,
          updated_at = CURRENT_TIMESTAMP
      `;
      for (const item of tariffs) {
        if (item.servicio_id && item.arancel_bob !== undefined) {
          await client.query(sql, [therapistId, Number(item.servicio_id), Number(item.arancel_bob)]);
        }
      }
    });

    return this.getTherapistTariffs(therapistId);
  }
}
