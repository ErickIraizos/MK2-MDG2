import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { config } from '../../config/environment.js';
import { PostgresConnection } from '../../core/PostgresConnection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Orden topológico estricto respetando claves foráneas
const TABLE_ORDER = [
  'roles',
  'usuarios',
  'ambientes',
  'especialidades',
  'servicios_aranceles',
  'configuraciones_sistema',
  'bitacora_auditoria',
  'terapeutas',
  'terapeutas_servicios_precios',
  'tutores',
  'pacientes',
  'derivaciones_pacientes',
  'paciente_tutor',
  'triajes_clinicos',
  'historias_clinicas',
  'anamnesis',
  'notas_evolucion',
  'catalogo_diagnosticos',
  'paciente_carpetas',
  'paciente_documentos',
  'planes_intervencion',
  'metas_terapeuticas',
  'seguimiento_metas_historial',
  'tutor_seguimiento_hogar',
  'citas',
  'whatsapp_sesiones',
  'push_subscriptions',
  'notificaciones_sistema',
  'recordatorios_citas',
  'consentimientos_informados',
  'informes_clinicos',
  'pagos_citas',
  'arqueos_caja',
  'inventario_baterias',
  'prestamos_baterias',
  'convenios_institucionales',
  'glosario_terminos',
  'talleres',
  'materiales_carpetas',
  'materiales_archivos'
];

function sanitizeValue(val, dataType) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') {
      if (['integer', 'smallint', 'double precision', 'numeric', 'date', 'timestamp with time zone', 'timestamp without time zone'].includes(dataType)) {
        return null;
      }
      return '';
    }
    if (dataType === 'date') {
      const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : null;
    }
    if (dataType === 'integer' || dataType === 'smallint') {
      const n = Number(trimmed);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    if (dataType === 'double precision' || dataType === 'numeric') {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
  }
  return val;
}

async function runMigration() {
  const sqlitePath = config.database.sqlitePath;
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`No se encontró la base SQLite origen en: ${sqlitePath}`);
  }

  const schemaSqlPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

  const sqlite = new Database(sqlitePath, { readonly: true });
  console.log(`[ETL] Origen SQLite: ${sqlitePath}`);

  try {
    // 1. Aplicar DDL completo en Supabase
    console.log('[ETL] Aplicando esquema PostgreSQL (40 tablas + índices + RLS)...');
    await PostgresConnection.transaction(async (client) => {
      await client.query(schemaSql);
    });
    console.log('[ETL] Esquema DDL aplicado exitosamente.');

    // 2. Migrar datos en transacción única respetando orden topológico
    const report = await PostgresConnection.transaction(async (client) => {
      const summary = [];
      const selfRefFixups = [];

      // Descubrir columnas y tipos reales en PostgreSQL
      const colTypesRes = await client.query(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `);

      const pgColsByTable = new Map();
      for (const r of colTypesRes.rows) {
        if (!pgColsByTable.has(r.table_name)) {
          pgColsByTable.set(r.table_name, new Map());
        }
        pgColsByTable.get(r.table_name).set(r.column_name, r.data_type);
      }

      for (const table of TABLE_ORDER) {
        const pgColMap = pgColsByTable.get(table);
        if (!pgColMap) {
          throw new Error(`La tabla ${table} no existe en PostgreSQL.`);
        }

        const sqliteExists = sqlite
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
          .get(table);

        if (!sqliteExists) {
          summary.push({ table, sqlite: 0, pg: 0 });
          continue;
        }

        const rows = sqlite.prepare(`SELECT * FROM "${table}" ORDER BY id ASC`).all();
        const sqliteCols = rows.length > 0 ? Object.keys(rows[0]) : [];
        const commonCols = sqliteCols.filter((c) => pgColMap.has(c));

        if (rows.length > 0 && commonCols.length > 0) {
          const colListSql = commonCols.map((c) => `"${c}"`).join(', ');
          const placeholders = commonCols.map((_, idx) => `$${idx + 1}`).join(', ');
          const insertSql = `INSERT INTO "${table}" (${colListSql}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

          for (const row of rows) {
            const values = commonCols.map((col) => {
              let v = sanitizeValue(row[col], pgColMap.get(col));
              // Diferir auto-referencias si apuntan a un ID posterior o aún no insertado
              if (table === 'usuarios' && col === 'desvinculado_por_id' && v !== null) {
                selfRefFixups.push({ table: 'usuarios', id: row.id, col: 'desvinculado_por_id', val: v });
                v = null;
              }
              if (table === 'citas' && col === 'reprogramada_de_cita_id' && v !== null) {
                selfRefFixups.push({ table: 'citas', id: row.id, col: 'reprogramada_de_cita_id', val: v });
                v = null;
              }
              return v;
            });

            await client.query(insertSql, values);
          }
        }

        // Sincronizar secuencia autoincremental (SERIAL)
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), (SELECT COUNT(*) > 0 FROM "${table}"))`,
          [table]
        );

        const pgCountRes = await client.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
        summary.push({
          table,
          sqlite: rows.length,
          pg: pgCountRes.rows[0].c
        });
      }

      // Segunda pasada para auto-referencias
      for (const fix of selfRefFixups) {
        await client.query(
          `UPDATE "${fix.table}" SET "${fix.col}" = $1 WHERE id = $2`,
          [fix.val, fix.id]
        );
      }

      return summary;
    });

    console.log('\n[ETL] Resumen de migración SQLite -> Supabase PostgreSQL:');
    console.table(report);

    const mismatches = report.filter((r) => r.sqlite !== r.pg);
    if (mismatches.length > 0) {
      console.warn('[ETL] ADVERTENCIA: Diferencias detectadas:', mismatches);
    } else {
      console.log('[ETL] ÉXITO TOTAL: Las 40 tablas migradas con paridad 100% de registros y secuencias sincronizadas.');
    }
  } finally {
    sqlite.close();
    await PostgresConnection.close();
  }
}

runMigration().catch((err) => {
  console.error('[ETL ERROR FATAL]:', err);
  process.exit(1);
});
