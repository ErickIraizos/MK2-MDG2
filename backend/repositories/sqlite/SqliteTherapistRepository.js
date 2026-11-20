import { ITherapistRepository } from '../../domain/interfaces/ITherapistRepository.js';
import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteTherapistRepository extends ITherapistRepository {
  constructor(db = DatabaseConnection.getInstance()) {
    super();
    this.db = db;
  }

  async findById(id) {
    const stmt = this.db.prepare(`
      SELECT t.*, 
             e.nombre as especialidad_nombre, e.color as especialidad_color,
             a.codigo as ambiente_codigo, a.nombre as ambiente_nombre,
             u.email as usuario_email
      FROM terapeutas t
      LEFT JOIN especialidades e ON t.especialidad_id = e.id
      LEFT JOIN ambientes a ON t.ambiente_preferido_id = a.id
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.id = ?
    `);
    return stmt.get(id) || null;
  }

  async findByUserId(userId) {
    const stmt = this.db.prepare(`
      SELECT t.*, 
             e.nombre as especialidad_nombre, e.color as especialidad_color,
             a.codigo as ambiente_codigo, a.nombre as ambiente_nombre
      FROM terapeutas t
      LEFT JOIN especialidades e ON t.especialidad_id = e.id
      LEFT JOIN ambientes a ON t.ambiente_preferido_id = a.id
      WHERE t.usuario_id = ?
    `);
    return stmt.get(userId) || null;
  }

  async findAll(includeInactive = false) {
    let query = `
      SELECT t.*, 
             e.nombre as especialidad_nombre, e.color as especialidad_color,
             a.codigo as ambiente_codigo, a.nombre as ambiente_nombre,
             u.email as usuario_email
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

    return this.db.prepare(query).all();
  }

  async create(therapistData) {
    const stmt = this.db.prepare(`
      INSERT INTO terapeutas (
        usuario_id, nombres, apellidos, registro_profesional, 
        especialidad_id, ambiente_preferido_id, telefono, 
        porcentaje_honorarios, color_agenda, bio, turnos_atencion,
        foto_url, titulos_academicos, diplomados_certificaciones,
        experiencia_anios, enfoque_terapeutico, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
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
    );

    return this.findById(info.lastInsertRowid);
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
        fields.push(`${key} = ?`);
        params.push(therapistData[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `UPDATE terapeutas SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...params);

    return this.findById(id);
  }

  async deleteLogical(id) {
    const stmt = this.db.prepare(`
      UPDATE terapeutas 
      SET activo = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(id);
    return true;
  }

  async getSpecialties() {
    return this.db.prepare(`
      SELECT * FROM especialidades WHERE activo = 1 ORDER BY id ASC
    `).all();
  }

  async getTherapistTariffs(therapistId) {
    const sql = `
      SELECT 
        sa.id AS servicio_id,
        sa.nombre AS servicio_nombre,
        sa.descripcion AS servicio_descripcion,
        sa.duracion_minutos,
        sa.arancel_bob AS arancel_base_clinica,
        COALESCE(tsp.arancel_bob, sa.arancel_bob) AS arancel_terapeuta_bob
      FROM servicios_aranceles sa
      LEFT JOIN terapeutas_servicios_precios tsp 
        ON sa.id = tsp.servicio_id AND tsp.terapeuta_id = ?
      WHERE sa.activo = 1
      ORDER BY sa.id ASC
    `;
    return this.db.prepare(sql).all(therapistId);
  }

  async saveTherapistTariffs(therapistId, tariffs = []) {
    const upsertStmt = this.db.prepare(`
      INSERT INTO terapeutas_servicios_precios (terapeuta_id, servicio_id, arancel_bob, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(terapeuta_id, servicio_id) DO UPDATE SET
        arancel_bob = excluded.arancel_bob,
        updated_at = CURRENT_TIMESTAMP
    `);

    const tx = this.db.transaction(() => {
      for (const item of tariffs) {
        if (item.servicio_id && item.arancel_bob !== undefined) {
          upsertStmt.run(therapistId, Number(item.servicio_id), Number(item.arancel_bob));
        }
      }
    });

    tx();
    return this.getTherapistTariffs(therapistId);
  }
}
