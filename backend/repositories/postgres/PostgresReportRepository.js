import { PostgresConnection } from '../../core/PostgresConnection.js';
import { IReportRepository } from '../../domain/interfaces/IReportRepository.js';

export class PostgresReportRepository extends IReportRepository {
  async createReport(data) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO informes_clinicos (
         paciente_id,
         historia_id,
         terapeuta_id,
         tipo_informe,
         titulo,
         motivo_evaluacion,
         antecedentes_relevantes,
         baterias_administradas,
         resultados_cuantitativos,
         conclusiones_cualitativas,
         diagnostico_codigo,
         diagnostico_descripcion,
         recomendaciones_colegio,
         recomendaciones_familia,
         ruta_docx,
         entregable_familiar,
         estado,
         fecha_emision,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        data.paciente_id,
        data.historia_id,
        data.terapeuta_id,
        data.tipo_informe || 'EVALUACION_NEUROPSICOLOGICA',
        data.titulo,
        data.motivo_evaluacion || null,
        data.antecedentes_relevantes || null,
        typeof data.baterias_administradas === 'object' && data.baterias_administradas !== null
          ? JSON.stringify(data.baterias_administradas)
          : (data.baterias_administradas || null),
        data.resultados_cuantitativos || null,
        data.conclusiones_cualitativas || null,
        data.diagnostico_codigo || null,
        data.diagnostico_descripcion || null,
        data.recomendaciones_colegio || null,
        data.recomendaciones_familia || null,
        data.ruta_docx || null,
        data.entregable_familiar ? 1 : 0,
        data.estado || 'EMITIDO'
      ]
    );

    return this.findById(rows[0].id);
  }

  async findById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         inf.*,
         p.codigo_expediente AS paciente_codigo,
         p.nombres AS paciente_nombres,
         p.apellidos AS paciente_apellidos,
         p.ci AS paciente_ci,
         p.fecha_nacimiento AS paciente_fecha_nacimiento,
         p.sexo AS paciente_sexo,
         p.colegio_ocupacion AS paciente_colegio_ocupacion,
         t.nombres AS terapeuta_nombres,
         t.apellidos AS terapeuta_apellidos,
         t.registro_profesional AS terapeuta_registro,
         esp.nombre AS terapeuta_especialidad,
         hc.numero_expediente AS historia_numero
       FROM informes_clinicos inf
       JOIN pacientes p ON inf.paciente_id = p.id
       JOIN historias_clinicas hc ON inf.historia_id = hc.id
       JOIN terapeutas t ON inf.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       WHERE inf.id = $1`,
      [id]
    );

    const row = rows[0];
    if (row && row.baterias_administradas) {
      try {
        row.baterias_administradas = JSON.parse(row.baterias_administradas);
      } catch (e) {}
    }
    return row || null;
  }

  async findByPatientId(patientId, options = {}) {
    let sql = `
      SELECT
        inf.*,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        esp.nombre AS terapeuta_especialidad
      FROM informes_clinicos inf
      JOIN terapeutas t ON inf.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      WHERE inf.paciente_id = $1
    `;
    const params = [patientId];

    if (options.soloEntregables) {
      sql += ` AND inf.entregable_familiar = 1 AND inf.estado IN ('EMITIDO', 'FIRMADO')`;
    }

    if (options.tipoInforme) {
      params.push(options.tipoInforme);
      sql += ` AND inf.tipo_informe = $${params.length}`;
    }

    sql += ` ORDER BY inf.fecha_emision DESC, inf.id DESC`;

    const { rows } = await PostgresConnection.query(sql, params);
    return rows.map(r => {
      if (r.baterias_administradas) {
        try {
          r.baterias_administradas = JSON.parse(r.baterias_administradas);
        } catch (e) {}
      }
      return r;
    });
  }

  async findByTherapistId(therapistId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         inf.*,
         p.codigo_expediente AS paciente_codigo,
         p.nombres AS paciente_nombres,
         p.apellidos AS paciente_apellidos
       FROM informes_clinicos inf
       JOIN pacientes p ON inf.paciente_id = p.id
       WHERE inf.terapeuta_id = $1
       ORDER BY inf.fecha_emision DESC`,
      [therapistId]
    );

    return rows.map(r => {
      if (r.baterias_administradas) {
        try {
          r.baterias_administradas = JSON.parse(r.baterias_administradas);
        } catch (e) {}
      }
      return r;
    });
  }

  async updateReport(id, data) {
    const updates = [];
    const params = [];

    const allowed = [
      'titulo',
      'motivo_evaluacion',
      'antecedentes_relevantes',
      'baterias_administradas',
      'resultados_cuantitativos',
      'conclusiones_cualitativas',
      'diagnostico_codigo',
      'diagnostico_descripcion',
      'recomendaciones_colegio',
      'recomendaciones_familia',
      'ruta_docx',
      'ruta_archivo_firmado',
      'entregable_familiar',
      'estado'
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        let val = data[key];
        if (key === 'baterias_administradas' && typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        } else if (key === 'entregable_familiar') {
          val = val ? 1 : 0;
        }
        params.push(val);
        updates.push(`${key} = $${params.length}`);
      }
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await PostgresConnection.query(
      `UPDATE informes_clinicos SET ${updates.join(', ')} WHERE id = $${params.length}`,
      params
    );

    return this.findById(id);
  }

  async updateDocxPath(id, docxPath) {
    await PostgresConnection.query(
      'UPDATE informes_clinicos SET ruta_docx = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [docxPath, id]
    );
    return true;
  }

  async deleteReport(id) {
    const res = await PostgresConnection.query('DELETE FROM informes_clinicos WHERE id = $1', [id]);
    return res.rowCount > 0;
  }
}
