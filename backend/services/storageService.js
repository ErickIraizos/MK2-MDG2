import path from 'path';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment.js';
import { AppError } from '../core/AppError.js';

export const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || 'psi-public';
export const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET || 'psi-private';

let cachedSupabaseClient = null;

/**
 * Obtiene (o inicializa perezosamente) el cliente administrativo de Supabase con Service Role Key.
 */
function getSupabaseClient() {
  if (cachedSupabaseClient) return cachedSupabaseClient;

  const url = (config.database.supabaseUrl || process.env.SUPABASE_URL || '').trim();
  const serviceKey = (config.database.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !serviceKey) {
    throw AppError.internal(
      'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno para Supabase Storage.'
    );
  }

  cachedSupabaseClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    ...(typeof globalThis.WebSocket === 'undefined' ? { realtime: { transport: ws } } : {})
  });

  return cachedSupabaseClient;
}

/**
 * Normaliza una clave lógica de objeto en Supabase Storage (sin barras iniciales).
 */
export function normalizeObjectPath(objectPath) {
  return String(objectPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

/**
 * Extrae la clave de objeto dentro de un bucket a partir de una URL pública, ruta /uploads/... o ruta absoluta Windows.
 */
export function extractStorageKey(rawPathOrUrl, defaultFolder = '', bucket = null) {
  if (!rawPathOrUrl) return null;
  const raw = String(rawPathOrUrl).trim();
  if (!raw || raw.startsWith('data:')) return null;

  const normalized = raw.replace(/\\/g, '/');

  // 1. URL completa de Supabase Storage (/storage/v1/object/public/<bucket>/<key> o /sign/<bucket>/<key>)
  const supabaseMarker = normalized.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?.*)?$/);
  if (supabaseMarker) {
    const [, foundBucket, foundKey] = supabaseMarker;
    if (!bucket || foundBucket === bucket) {
      return normalizeObjectPath(decodeURIComponent(foundKey));
    }
  }

  // 2. Ruta con segmento /uploads/<subcarpeta>/<archivo> (incluyendo rutas absolutas C:\...\backend\uploads\...)
  const uploadsIdx = normalized.toLowerCase().lastIndexOf('/uploads/');
  if (uploadsIdx !== -1) {
    return normalizeObjectPath(normalized.slice(uploadsIdx + '/uploads/'.length));
  }
  if (normalized.toLowerCase().startsWith('uploads/')) {
    return normalizeObjectPath(normalized.slice('uploads/'.length));
  }

  // 3. Ya viene con prefijo de carpeta (ej. reports/..., patient_documents/..., receipts/..., materiales/...)
  const clean = normalizeObjectPath(normalized);
  if (clean.includes('/')) {
    return clean;
  }

  // 4. Solo basename (ej. doc_123.pdf o mat_abc.pdf)
  return defaultFolder ? `${normalizeObjectPath(defaultFolder)}/${clean}` : clean;
}

export const storageService = {
  PUBLIC_BUCKET,
  PRIVATE_BUCKET,
  extractStorageKey,

  /**
   * Genera un nombre único seguro manteniendo la extensión original en minúsculas.
   */
  buildSafeFilename(prefix, originalName = '') {
    const ext = path.extname(originalName).toLowerCase();
    const suffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return `${prefix}_${suffix}${ext}`;
  },

  /**
   * Construye la URL pública HTTPS permanente para objetos en el bucket psi-public.
   */
  getPublicUrl(objectPath, bucket = PUBLIC_BUCKET) {
    const client = getSupabaseClient();
    const cleanPath = normalizeObjectPath(objectPath);
    const { data } = client.storage.from(bucket).getPublicUrl(cleanPath);
    return data?.publicUrl || null;
  },

  /**
   * Sube un Buffer al bucket indicado y devuelve la clave y (si es público) su URL HTTPS.
   */
  async uploadBuffer({ bucket, objectPath, buffer, contentType = 'application/octet-stream', upsert = true }) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw AppError.badRequest('El buffer del archivo está vacío o es inválido.', 'INVALID_FILE_BUFFER');
    }

    const client = getSupabaseClient();
    const cleanPath = normalizeObjectPath(objectPath);

    const { error } = await client.storage.from(bucket).upload(cleanPath, buffer, {
      contentType,
      upsert
    });

    if (error) {
      throw new AppError(
        `Error al subir archivo a Supabase Storage (${bucket}/${cleanPath}): ${error.message}`,
        502,
        'STORAGE_UPLOAD_ERROR'
      );
    }

    return {
      bucket,
      path: cleanPath,
      publicUrl: bucket === PUBLIC_BUCKET ? this.getPublicUrl(cleanPath, bucket) : null
    };
  },

  async uploadPublic(objectPath, buffer, contentType, upsert = true) {
    return this.uploadBuffer({
      bucket: PUBLIC_BUCKET,
      objectPath,
      buffer,
      contentType,
      upsert
    });
  },

  async uploadPrivate(objectPath, buffer, contentType, upsert = true) {
    return this.uploadBuffer({
      bucket: PRIVATE_BUCKET,
      objectPath,
      buffer,
      contentType,
      upsert
    });
  },

  /**
   * Descarga un objeto completo en memoria como Buffer.
   */
  async downloadBuffer(bucket, objectPath) {
    const client = getSupabaseClient();
    const cleanPath = normalizeObjectPath(objectPath);

    const { data, error } = await client.storage.from(bucket).download(cleanPath);
    if (error || !data) {
      throw AppError.notFound(
        `No se encontró el archivo solicitado en almacenamiento (${cleanPath}).`
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },

  /**
   * Genera una URL firmada temporal (por defecto 60 segundos) para archivos privados.
   */
  async createSignedUrl(bucket, objectPath, expiresInSeconds = 60, { download = false } = {}) {
    const client = getSupabaseClient();
    const cleanPath = normalizeObjectPath(objectPath);
    const options = download ? { download } : undefined;

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(cleanPath, expiresInSeconds, options);

    if (error || !data?.signedUrl) {
      throw AppError.notFound(
        `No fue posible generar enlace temporal para el archivo (${cleanPath}).`
      );
    }

    return data.signedUrl;
  },

  /**
   * Elimina un objeto del bucket correspondiente (si recibe una URL pública completa, extrae la clave).
   */
  async deleteObject(bucket, objectPathOrUrl) {
    const key = extractStorageKey(objectPathOrUrl, '', bucket);
    if (!key) return false;

    const client = getSupabaseClient();
    const { error } = await client.storage.from(bucket).remove([key]);
    if (error) {
      console.warn(`[Storage WARN] No se pudo eliminar ${bucket}/${key}: ${error.message}`);
      return false;
    }
    return true;
  }
};
