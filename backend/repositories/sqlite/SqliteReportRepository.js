import { DatabaseConnection } from '../../core/DatabaseConnection.js';
import { IReportRepository } from '../../domain/interfaces/IReportRepository.js';

export class SqliteReportRepository extends IReportRepository {
  constructor() {
    super();
    this.db = DatabaseConnection.getInstance();
    this._ensureSchema();
  }

  _ensureSchema() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS informes_clinicos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          paciente_id INTEGER NOT NULL,
          historia_id INTEGER NOT NULL,
          terapeuta_id INTEGER NOT NULL,
          tipo_informe TEXT NOT NULL CHECK (tipo_informe IN (
            'EVALUACION_NEUROPSICOLOGICA',
            'INFORME_PSICOPEDAGOGICO',
            'VALORACION_GERONTOLOGICA',
            'EVOLUCION_CLINICA',
            'INFORME_ESCOLAR',
            'REPORTE_FAMILIAR_AVANCE'
          )),
          titulo TEXT NOT NULL,
          motivo_evaluacion TEXT,
          antecedentes_relevantes TEXT,
          baterias_administradas TEXT,
          resultados_cuantitativos TEXT,
          conclusiones_cualitativas TEXT,
          diagnostico_codigo TEXT,
          diagnostico_descripcion TEXT,
          recomendaciones_colegio TEXT,
          recomendaciones_familia TEXT,
          ruta_docx TEXT,
          ruta_archivo_firmado TEXT,
          entregable_familiar INTEGER DEFAULT 0 CHECK (entregable_familiar IN (0, 1)),
          estado TEXT DEFAULT 'EMITIDO' CHECK (estado IN ('BORRADOR', 'EMITIDO', 'FIRMADO', 'ARCHIVADO')),
          fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
          FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE RESTRICT,
          FOREIGN KEY (terapeuta_id) REFERENCES terapeutas(id) ON DELETE RESTRICT
        )
      `).run();
    } catch (e) {
      console.warn('[SqliteReportRepository] Nota de esquema:', e.message);
    }
  }

  async createReport(data) {
    const stmt = this.db.prepare(`
      INSERT INTO informes_clinicos (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      data.paciente_id,
      data.historia_id,
      data.terapeuta_id,
      data.tipo_informe || 'EVALUACION_NEUROPSICOLOGICA',
      data.titulo,
      data.motivo_evaluacion || null,
      data.antecedentes_relevantes || null,
      typeof data.baterias_administradas === 'object' ? JSON.stringify(data.baterias_administradas) : (data.baterias_administradas || null),
      data.resultados_cuantitativos || null,
      data.conclusiones_cualitativas || null,
      data.diagnostico_codigo || null,
      data.diagnostico_descripcion || null,
      data.recomendaciones_colegio || null,
      data.recomendaciones_familia || null,
      data.ruta_docx || null,
      data.entregable_familiar ? 1 : 0,
      data.estado || 'EMITIDO'
    );

    return this.findById(result.lastInsertRowid);
  }

  async findById(id) {
    const stmt = this.db.prepare(`
      SELECT 
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
      WHERE inf.id = ?
    `);

    const row = stmt.get(id);
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
      WHERE inf.paciente_id = ?
    `;
    const params = [patientId];

    if (options.soloEntregables) {
      sql += ` AND inf.entregable_familiar = 1 AND inf.estado IN ('EMITIDO', 'FIRMADO')`;
    }

    if (options.tipoInforme) {
      sql += ` AND inf.tipo_informe = ?`;
      params.push(options.tipoInforme);
    }

    sql += ` ORDER BY inf.fecha_emision DESC, inf.id DESC`;

    const rows = this.db.prepare(sql).all(...params);
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
    const stmt = this.db.prepare(`
      SELECT 
        inf.*,
        p.codigo_expediente AS paciente_codigo,
        p.nombres AS paciente_nombres,
        p.apellidos AS paciente_apellidos
      FROM informes_clinicos inf
      JOIN pacientes p ON inf.paciente_id = p.id
      WHERE inf.terapeuta_id = ?
      ORDER BY inf.fecha_emision DESC
    `);

    const rows = stmt.all(therapistId);
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
        updates.push(`${key} = ?`);
        if (key === 'baterias_administradas' && typeof data[key] === 'object') {
          params.push(JSON.stringify(data[key]));
        } else if (key === 'entregable_familiar') {
          params.push(data[key] ? 1 : 0);
        } else {
          params.push(data[key]);
        }
      }
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    const sql = `UPDATE informes_clinicos SET ${updates.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...params);

    return this.findById(id);
  }

  async updateDocxPath(id, docxPath) {
    const stmt = this.db.prepare("UPDATE informes_clinicos SET ruta_docx = ?, updated_at = datetime('now') WHERE id = ?");
    stmt.run(docxPath, id);
    return true;
  }

  async deleteReport(id) {
    const stmt = this.db.prepare("DELETE FROM informes_clinicos WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
