import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

export class DatabaseConnection {
  static getInstance() {
    if (!dbInstance) {
      const dbPath = config.database.sqlitePath;
      const dbDir = path.dirname(dbPath);

      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const isNewDatabase = !fs.existsSync(dbPath);
      
      dbInstance = new Database(dbPath, {
        verbose: config.env === 'development' ? null : null
      });

      // Configuración de alto rendimiento y seguridad SQLite
      dbInstance.pragma('journal_mode = WAL');
      dbInstance.pragma('foreign_keys = ON');
      dbInstance.pragma('synchronous = NORMAL');

      console.log(`[Database] Conectado exitosamente a SQLite: ${dbPath} (Modo WAL activado)`);

      // Aplicar esquema incremental y semillas seguras (todas usan IF NOT EXISTS e INSERT OR IGNORE)
      DatabaseConnection.initializeDatabase(dbInstance);
    }
    return dbInstance;
  }

  static initializeDatabase(db = dbInstance) {
    const schemaPath = path.resolve(__dirname, '../database/sqlite/schema.sql');
    const seedPath = path.resolve(__dirname, '../database/sqlite/seed.sql');

    // 1. Migraciones seguras para columnas agregadas a la tabla pacientes (si la tabla ya existe)
    try {
      const checkTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pacientes'").get();
      if (checkTable) {
        const tableInfo = db.prepare("PRAGMA table_info(pacientes)").all();
        const columnNames = tableInfo.map(col => col.name);

        if (!columnNames.includes('creado_por_usuario_id')) {
          db.exec("ALTER TABLE pacientes ADD COLUMN creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL");
        }
        if (!columnNames.includes('terapeuta_id')) {
          db.exec("ALTER TABLE pacientes ADD COLUMN terapeuta_id INTEGER REFERENCES terapeutas(id) ON DELETE SET NULL");
        }
        if (!columnNames.includes('eliminado_por_usuario_id')) {
          db.exec("ALTER TABLE pacientes ADD COLUMN eliminado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL");
        }
        if (!columnNames.includes('fecha_eliminacion')) {
          db.exec("ALTER TABLE pacientes ADD COLUMN fecha_eliminacion DATETIME");
        }
        if (!columnNames.includes('motivo_baja')) {
          db.exec("ALTER TABLE pacientes ADD COLUMN motivo_baja TEXT");
        }

        // Asignar creadores y terapeutas por defecto a pacientes semilla si están en null
        db.exec(`
          UPDATE pacientes SET creado_por_usuario_id = 1, terapeuta_id = 1 WHERE id = 1 AND terapeuta_id IS NULL;
          UPDATE pacientes SET creado_por_usuario_id = 2, terapeuta_id = 2 WHERE id = 2 AND terapeuta_id IS NULL;
          UPDATE pacientes SET creado_por_usuario_id = 2, terapeuta_id = 2 WHERE id = 3 AND terapeuta_id IS NULL;
          UPDATE pacientes SET creado_por_usuario_id = 1, terapeuta_id = 3 WHERE id = 4 AND terapeuta_id IS NULL;
        `);
      }

      // 1.1 Migraciones seguras para usuarios (baja lógica y desvinculación)
      const checkUsers = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'").get();
      if (checkUsers) {
        const uInfo = db.prepare("PRAGMA table_info(usuarios)").all();
        const uCols = uInfo.map(c => c.name);
        if (!uCols.includes('fecha_desvinculacion')) {
          db.exec("ALTER TABLE usuarios ADD COLUMN fecha_desvinculacion DATETIME");
        }
        if (!uCols.includes('motivo_desvinculacion')) {
          db.exec("ALTER TABLE usuarios ADD COLUMN motivo_desvinculacion TEXT");
        }
        if (!uCols.includes('desvinculado_por_id')) {
          db.exec("ALTER TABLE usuarios ADD COLUMN desvinculado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL");
        }
        if (!uCols.includes('firma_digital_blob')) {
          db.exec("ALTER TABLE usuarios ADD COLUMN firma_digital_blob TEXT");
        }
        if (!uCols.includes('firma_actualizada_at')) {
          db.exec("ALTER TABLE usuarios ADD COLUMN firma_actualizada_at DATETIME");
        }
        if (!uCols.includes('foto_url')) {
          db.exec("ALTER TABLE usuarios ADD COLUMN foto_url TEXT");
        }
      }

      // 1.1b Migraciones seguras para terapeutas (firma digital colegiada CPB)
      const checkTherapists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='terapeutas'").get();
      if (checkTherapists) {
        const tInfo = db.prepare("PRAGMA table_info(terapeutas)").all();
        const tCols = tInfo.map(c => c.name);
        if (!tCols.includes('firma_digital_blob')) {
          db.exec("ALTER TABLE terapeutas ADD COLUMN firma_digital_blob TEXT");
        }
        if (!tCols.includes('firma_actualizada_at')) {
          db.exec("ALTER TABLE terapeutas ADD COLUMN firma_actualizada_at DATETIME");
        }
        if (!tCols.includes('foto_url')) {
          db.exec("ALTER TABLE terapeutas ADD COLUMN foto_url TEXT");
        }
        if (!tCols.includes('titulos_academicos')) {
          db.exec("ALTER TABLE terapeutas ADD COLUMN titulos_academicos TEXT");
        }
        if (!tCols.includes('diplomados_certificaciones')) {
          db.exec("ALTER TABLE terapeutas ADD COLUMN diplomados_certificaciones TEXT");
        }
        if (!tCols.includes('experiencia_anios')) {
          db.exec("ALTER TABLE terapeutas ADD COLUMN experiencia_anios TEXT");
        }
        if (!tCols.includes('enfoque_terapeutico')) {
          db.exec("ALTER TABLE terapeutas ADD COLUMN enfoque_terapeutico TEXT");
        }
      }

      // 1.2 Migraciones seguras para bitacora_auditoria (snapshots inmutables)
      const checkAudit = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bitacora_auditoria'").get();
      if (checkAudit) {
        const bInfo = db.prepare("PRAGMA table_info(bitacora_auditoria)").all();
        const bCols = bInfo.map(c => c.name);
        if (!bCols.includes('usuario_nombre_snapshot')) {
          db.exec("ALTER TABLE bitacora_auditoria ADD COLUMN usuario_nombre_snapshot TEXT");
        }
        if (!bCols.includes('usuario_email_snapshot')) {
          db.exec("ALTER TABLE bitacora_auditoria ADD COLUMN usuario_email_snapshot TEXT");
        }
        if (!bCols.includes('rol_nombre_snapshot')) {
          db.exec("ALTER TABLE bitacora_auditoria ADD COLUMN rol_nombre_snapshot TEXT");
        }

        // Backfill histórico de snapshots para registros pasados de auditoría
        db.exec(`
          UPDATE bitacora_auditoria
          SET usuario_nombre_snapshot = (SELECT nombre_completo FROM usuarios WHERE usuarios.id = bitacora_auditoria.usuario_id),
              usuario_email_snapshot = (SELECT email FROM usuarios WHERE usuarios.id = bitacora_auditoria.usuario_id),
              rol_nombre_snapshot = (SELECT r.nombre FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = bitacora_auditoria.usuario_id)
          WHERE usuario_nombre_snapshot IS NULL AND usuario_id IS NOT NULL;
        `);
      }

      // 1.3 Migraciones seguras para citas (servicio y arancel personalizado)
      const checkCitas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='citas'").get();
      if (checkCitas) {
        const cInfo = db.prepare("PRAGMA table_info(citas)").all();
        const cCols = cInfo.map(c => c.name);
        if (!cCols.includes('servicio_personalizado')) {
          db.exec("ALTER TABLE citas ADD COLUMN servicio_personalizado TEXT");
        }
        if (!cCols.includes('arancel_personalizado')) {
          db.exec("ALTER TABLE citas ADD COLUMN arancel_personalizado REAL");
        }
        if (!cCols.includes('recordatorio_24h_enviado')) {
          db.exec("ALTER TABLE citas ADD COLUMN recordatorio_24h_enviado INTEGER DEFAULT 0");
        }
        if (!cCols.includes('recordatorio_2h_enviado')) {
          db.exec("ALTER TABLE citas ADD COLUMN recordatorio_2h_enviado INTEGER DEFAULT 0");
        }
        if (!cCols.includes('recordatorio_24h_at')) {
          db.exec("ALTER TABLE citas ADD COLUMN recordatorio_24h_at DATETIME");
        }
        if (!cCols.includes('recordatorio_2h_at')) {
          db.exec("ALTER TABLE citas ADD COLUMN recordatorio_2h_at DATETIME");
        }
      }

      // 1.4 Migraciones seguras para informes_clinicos (soporte REPORTE_FAMILIAR_AVANCE, FIRMADO y ruta_archivo_firmado)
      const checkInformes = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='informes_clinicos'").get();
      if (checkInformes && (!checkInformes.sql.includes('REPORTE_FAMILIAR_AVANCE') || !checkInformes.sql.includes('FIRMADO'))) {
        db.pragma('foreign_keys = OFF');
        db.exec(`
          CREATE TABLE IF NOT EXISTS informes_clinicos_mig (
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
          );

          INSERT INTO informes_clinicos_mig (
            id, paciente_id, historia_id, terapeuta_id, tipo_informe, titulo, motivo_evaluacion,
            antecedentes_relevantes, baterias_administradas, resultados_cuantitativos,
            conclusiones_cualitativas, diagnostico_codigo, diagnostico_descripcion,
            recomendaciones_colegio, recomendaciones_familia, ruta_docx,
            entregable_familiar, estado, fecha_emision, created_at, updated_at
          )
          SELECT 
            id, paciente_id, historia_id, terapeuta_id, tipo_informe, titulo, motivo_evaluacion,
            antecedentes_relevantes, baterias_administradas, resultados_cuantitativos,
            conclusiones_cualitativas, diagnostico_codigo, diagnostico_descripcion,
            recomendaciones_colegio, recomendaciones_familia, ruta_docx,
            entregable_familiar, estado, fecha_emision, created_at, updated_at
          FROM informes_clinicos;

          DROP TABLE informes_clinicos;
          ALTER TABLE informes_clinicos_mig RENAME TO informes_clinicos;

          CREATE INDEX IF NOT EXISTS idx_informes_paciente ON informes_clinicos(paciente_id);
          CREATE INDEX IF NOT EXISTS idx_informes_historia ON informes_clinicos(historia_id);
          CREATE INDEX IF NOT EXISTS idx_informes_terapeuta ON informes_clinicos(terapeuta_id);
          CREATE INDEX IF NOT EXISTS idx_informes_tipo ON informes_clinicos(tipo_informe);
        `);
        db.pragma('foreign_keys = ON');
        console.log('[Database] Migración informes_clinicos aplicada exitosamente.');
      } else if (checkInformes) {
        // Asegurar que la columna ruta_archivo_firmado exista
        const infInfo = db.prepare("PRAGMA table_info(informes_clinicos)").all();
        const infCols = infInfo.map(c => c.name);
        if (!infCols.includes('ruta_archivo_firmado')) {
          db.exec("ALTER TABLE informes_clinicos ADD COLUMN ruta_archivo_firmado TEXT");
        }
      }
    } catch (migErr) {
      console.warn('[Database] Nota en verificación de columnas previas:', migErr.message);
    }

    // 2. Aplicar esquema DDL completo (creará tablas nuevas como derivaciones_pacientes e índices)
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schemaSql);
      console.log('[Database] Esquema DDL aplicado correctamente.');
    }

    // 3. Aplicar datos semilla
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      db.exec(seedSql);
      console.log('[Database] Datos iniciales (Seed) insertados correctamente.');
    }
  }

  static close() {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
      console.log('[Database] Conexión a SQLite cerrada.');
    }
  }
}
