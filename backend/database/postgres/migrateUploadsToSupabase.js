import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import '../../config/environment.js';
import { PostgresConnection } from '../../core/PostgresConnection.js';
import {
  storageService,
  PUBLIC_BUCKET,
  PRIVATE_BUCKET,
  extractStorageKey
} from '../../services/storageService.js';
import { matchesBufferSignature } from '../../utils/fileValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

const PUBLIC_FOLDERS = new Set(['qr', 'convenios', 'instalaciones', 'therapists', 'batteries']);
const PRIVATE_FOLDERS = new Set(['patient_documents', 'reports', 'receipts', 'consents']);

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function walkFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

async function runMigration() {
  console.log('=== FASE 2: MIGRACIÓN DE ARCHIVOS A SUPABASE STORAGE ===');
  console.log(`Directorio origen: ${UPLOADS_ROOT}`);

  PostgresConnection.getPool();

  // Consultar visibilidad de materiales_archivos para clasificar materiales/ públicos vs privados
  const { rows: materialRows } = await PostgresConnection.query(
    `SELECT id, nombre_almacenado, es_publico FROM materiales_archivos`
  );
  const materialPrivacyMap = new Map();
  for (const row of materialRows) {
    const key = extractStorageKey(row.nombre_almacenado, 'materiales');
    if (key) {
      materialPrivacyMap.set(path.posix.basename(key), Number(row.es_publico) === 0 ? 'private' : 'public');
    }
  }

  // Consultar archivos referenciados en BD para saber si un archivo anómalo está en uso
  const referencedKeys = new Set();
  const collectRef = (val, defaultFolder) => {
    const k = extractStorageKey(val, defaultFolder);
    if (k) referencedKeys.add(k);
  };

  const { rows: cfgRows } = await PostgresConnection.query(`SELECT clave, valor FROM configuraciones_sistema WHERE valor IS NOT NULL`);
  cfgRows.forEach(r => collectRef(r.valor, 'instalaciones'));

  const { rows: thRows } = await PostgresConnection.query(`SELECT id, qr_cobro_url, foto_url FROM terapeutas`);
  thRows.forEach(r => {
    collectRef(r.qr_cobro_url, 'qr');
    collectRef(r.foto_url, 'therapists');
  });

  const { rows: convRows } = await PostgresConnection.query(`SELECT id, imagen_url FROM convenios_institucionales`);
  convRows.forEach(r => collectRef(r.imagen_url, 'convenios'));

  const { rows: batRows } = await PostgresConnection.query(`SELECT id, imagen_url, documento_referencia_url FROM inventario_baterias`);
  batRows.forEach(r => {
    collectRef(r.imagen_url, 'batteries');
    collectRef(r.documento_referencia_url, 'batteries');
  });

  const { rows: payRows } = await PostgresConnection.query(`SELECT id, comprobante_url FROM pagos_citas WHERE comprobante_url IS NOT NULL`);
  payRows.forEach(r => collectRef(r.comprobante_url, 'receipts'));

  const { rows: repRows } = await PostgresConnection.query(`SELECT id, ruta_docx, ruta_archivo_firmado FROM informes_clinicos`);
  repRows.forEach(r => {
    collectRef(r.ruta_docx, 'reports');
    collectRef(r.ruta_archivo_firmado, 'reports');
  });

  const { rows: docRows } = await PostgresConnection.query(`SELECT id, nombre_almacenado FROM paciente_documentos`);
  docRows.forEach(r => collectRef(r.nombre_almacenado, 'patient_documents'));

  const files = walkFiles(UPLOADS_ROOT);
  console.log(`Archivos encontrados en backend/uploads/: ${files.length}`);

  const stats = { uploadedPublic: 0, uploadedPrivate: 0, skippedCorruptOrphan: 0, warnings: 0, dbUpdated: 0 };

  for (const absPath of files) {
    const relKey = path.relative(UPLOADS_ROOT, absPath).replace(/\\/g, '/');
    const folder = relKey.split('/')[0];
    const baseName = path.posix.basename(relKey);
    const buffer = fs.readFileSync(absPath);
    const mime = getContentType(absPath);
    const isReferenced = referencedKeys.has(relKey) || materialPrivacyMap.has(baseName);

    // Validación binaria de magic bytes antes de subir
    const sigOk = buffer.length > 0 && matchesBufferSignature(buffer, mime);
    if (!sigOk) {
      if (!isReferenced) {
        console.warn(`[SKIP huérfano inválido] ${relKey} (${buffer.length} bytes, firma ${mime} inválida y no referenciado en BD)`);
        stats.skippedCorruptOrphan++;
        continue;
      }
      console.warn(`[WARN referenciado con firma atípica] ${relKey} (${buffer.length} bytes, ${mime}) — se sube igualmente para preservar referencia en BD.`);
      stats.warnings++;
    }

    let targetBucket = null;
    if (PUBLIC_FOLDERS.has(folder)) {
      targetBucket = PUBLIC_BUCKET;
    } else if (PRIVATE_FOLDERS.has(folder)) {
      targetBucket = PRIVATE_BUCKET;
    } else if (folder === 'materiales') {
      const scope = materialPrivacyMap.get(baseName) || 'public';
      targetBucket = scope === 'private' ? PRIVATE_BUCKET : PUBLIC_BUCKET;
    } else {
      console.warn(`[WARN carpeta desconocida] ${relKey} -> enviado a ${PRIVATE_BUCKET}`);
      targetBucket = PRIVATE_BUCKET;
    }

    await storageService.uploadBuffer({
      bucket: targetBucket,
      objectPath: relKey,
      buffer,
      contentType: mime,
      upsert: true
    });

    if (targetBucket === PUBLIC_BUCKET) {
      stats.uploadedPublic++;
    } else {
      stats.uploadedPrivate++;
    }
    console.log(`[OK] ${relKey} -> ${targetBucket}`);
  }

  // =========================================================================
  // ACTUALIZAR RUTAS EN SUPABASE POSTGRESQL
  // =========================================================================
  console.log('\n=== ACTUALIZANDO REFERENCIAS EN POSTGRESQL ===');

  // 1. configuraciones_sistema
  for (const r of cfgRows) {
    if (String(r.valor).startsWith('/uploads/')) {
      const key = extractStorageKey(r.valor);
      const publicUrl = storageService.getPublicUrl(key, PUBLIC_BUCKET);
      await PostgresConnection.query(`UPDATE configuraciones_sistema SET valor = $1 WHERE clave = $2`, [publicUrl, r.clave]);
      stats.dbUpdated++;
      console.log(`configuraciones_sistema[${r.clave}] -> ${publicUrl}`);
    }
  }

  // 2. terapeutas (qr_cobro_url, foto_url)
  for (const r of thRows) {
    const newQr = String(r.qr_cobro_url || '').startsWith('/uploads/')
      ? storageService.getPublicUrl(extractStorageKey(r.qr_cobro_url, 'qr'), PUBLIC_BUCKET)
      : r.qr_cobro_url;
    const newFoto = String(r.foto_url || '').startsWith('/uploads/')
      ? storageService.getPublicUrl(extractStorageKey(r.foto_url, 'therapists'), PUBLIC_BUCKET)
      : r.foto_url;
    if (newQr !== r.qr_cobro_url || newFoto !== r.foto_url) {
      await PostgresConnection.query(
        `UPDATE terapeutas SET qr_cobro_url = $1, foto_url = $2 WHERE id = $3`,
        [newQr, newFoto, r.id]
      );
      stats.dbUpdated++;
      console.log(`terapeutas[${r.id}] actualizado`);
    }
  }

  // 3. convenios_institucionales
  for (const r of convRows) {
    if (String(r.imagen_url || '').startsWith('/uploads/')) {
      const publicUrl = storageService.getPublicUrl(extractStorageKey(r.imagen_url, 'convenios'), PUBLIC_BUCKET);
      await PostgresConnection.query(`UPDATE convenios_institucionales SET imagen_url = $1 WHERE id = $2`, [publicUrl, r.id]);
      stats.dbUpdated++;
      console.log(`convenios_institucionales[${r.id}] -> ${publicUrl}`);
    }
  }

  // 4. inventario_baterias
  for (const r of batRows) {
    const newImg = String(r.imagen_url || '').startsWith('/uploads/')
      ? storageService.getPublicUrl(extractStorageKey(r.imagen_url, 'batteries'), PUBLIC_BUCKET)
      : r.imagen_url;
    const newDoc = String(r.documento_referencia_url || '').startsWith('/uploads/')
      ? storageService.getPublicUrl(extractStorageKey(r.documento_referencia_url, 'batteries'), PUBLIC_BUCKET)
      : r.documento_referencia_url;
    if (newImg !== r.imagen_url || newDoc !== r.documento_referencia_url) {
      await PostgresConnection.query(
        `UPDATE inventario_baterias SET imagen_url = $1, documento_referencia_url = $2 WHERE id = $3`,
        [newImg, newDoc, r.id]
      );
      stats.dbUpdated++;
      console.log(`inventario_baterias[${r.id}] actualizado`);
    }
  }

  // 5. pagos_citas (psi-private: clave receipts/...)
  for (const r of payRows) {
    if (r.comprobante_url && !r.comprobante_url.startsWith('data:')) {
      const key = extractStorageKey(r.comprobante_url, 'receipts', PRIVATE_BUCKET);
      if (key && key !== r.comprobante_url) {
        await PostgresConnection.query(`UPDATE pagos_citas SET comprobante_url = $1 WHERE id = $2`, [key, r.id]);
        stats.dbUpdated++;
        console.log(`pagos_citas[${r.id}] -> ${key}`);
      }
    }
  }

  // 6. informes_clinicos (psi-private: clave reports/...)
  for (const r of repRows) {
    const newDocx = r.ruta_docx ? extractStorageKey(r.ruta_docx, 'reports', PRIVATE_BUCKET) : null;
    const newSigned = r.ruta_archivo_firmado ? extractStorageKey(r.ruta_archivo_firmado, 'reports', PRIVATE_BUCKET) : null;
    if (newDocx !== r.ruta_docx || newSigned !== r.ruta_archivo_firmado) {
      await PostgresConnection.query(
        `UPDATE informes_clinicos SET ruta_docx = $1, ruta_archivo_firmado = $2 WHERE id = $3`,
        [newDocx, newSigned, r.id]
      );
      stats.dbUpdated++;
      console.log(`informes_clinicos[${r.id}] -> docx=${newDocx} signed=${newSigned}`);
    }
  }

  // 7. paciente_documentos (psi-private: clave patient_documents/...)
  for (const r of docRows) {
    const key = extractStorageKey(r.nombre_almacenado, 'patient_documents', PRIVATE_BUCKET);
    if (key && key !== r.nombre_almacenado) {
      await PostgresConnection.query(`UPDATE paciente_documentos SET nombre_almacenado = $1 WHERE id = $2`, [key, r.id]);
      stats.dbUpdated++;
      console.log(`paciente_documentos[${r.id}] -> ${key}`);
    }
  }

  // 8. materiales_archivos (es_publico=1 -> URL HTTPS psi-public, es_publico=0 -> clave materiales/... psi-private)
  for (const r of materialRows) {
    const isPublic = Number(r.es_publico) !== 0;
    const key = extractStorageKey(r.nombre_almacenado, 'materiales');
    if (!key) continue;
    const targetValue = isPublic
      ? storageService.getPublicUrl(key, PUBLIC_BUCKET)
      : key;
    if (targetValue !== r.nombre_almacenado) {
      await PostgresConnection.query(`UPDATE materiales_archivos SET nombre_almacenado = $1 WHERE id = $2`, [targetValue, r.id]);
      stats.dbUpdated++;
      console.log(`materiales_archivos[${r.id}] (public=${isPublic}) -> ${targetValue}`);
    }
  }

  console.log('\n=== RESUMEN DE MIGRACIÓN ===');
  console.log(JSON.stringify(stats, null, 2));
  await PostgresConnection.getPool().end();
}

runMigration()
  .then(() => {
    console.log('Migración Fase 2 completada exitosamente.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error fatal en migración Fase 2:', err);
    process.exit(1);
  });
