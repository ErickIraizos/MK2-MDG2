import path from 'path';
import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';
import { storageService, PUBLIC_BUCKET, PRIVATE_BUCKET, extractStorageKey } from './storageService.js';

export class MaterialService {
  constructor() {
    this.materialRepo = RepositoryFactory.getMaterialRepository();
  }

  async getFolders(includeInactive = false, scope = 'public', userId = null) {
    return await this.materialRepo.getAllFolders(includeInactive, scope, userId);
  }

  async getFolderById(id) {
    const folder = await this.materialRepo.getFolderById(id);
    if (!folder) {
      throw new Error(`La carpeta con ID [${id}] no existe.`);
    }
    return folder;
  }

  async createFolder({ nombre, descripcion, color, icono, es_publico }, userId) {
    if (!nombre || !nombre.trim()) {
      throw new Error('El nombre de la carpeta de materiales es obligatorio.');
    }
    return await this.materialRepo.createFolder({
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : null,
      color: color || '#584294',
      icono: icono || 'folder',
      creado_por_usuario_id: userId,
      es_publico: es_publico !== undefined ? Number(es_publico) : 1
    });
  }

  async updateFolder(id, { nombre, descripcion, color, icono }) {
    await this.getFolderById(id);
    return await this.materialRepo.updateFolder(id, {
      nombre: nombre ? nombre.trim() : undefined,
      descripcion: descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : undefined,
      color,
      icono
    });
  }

  async deleteFolder(id) {
    await this.getFolderById(id);
    return await this.materialRepo.deleteFolder(id);
  }

  async getFiles(carpetaId, search = '', scope = 'public', userId = null) {
    await this.getFolderById(carpetaId);
    return await this.materialRepo.getFilesByFolder(carpetaId, search, scope, userId);
  }

  async saveFile({ file, carpetaId, categoria, descripcion, es_publico = 1, userId }) {
    if (!file || !file.buffer) {
      throw new Error('No se adjuntó ningún archivo para subir.');
    }
    await this.getFolderById(carpetaId);

    const ext = path.extname(file.originalname || '').toLowerCase();
    const cleanBase = path.basename(file.originalname || 'material', ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40) || 'material';
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const objectPath = `materiales/mat_${cleanBase}_${uniqueSuffix}${ext}`;
    const isPublic = Number(es_publico) !== 0;

    let storedReference = objectPath;
    if (isPublic) {
      const uploaded = await storageService.uploadPublic(objectPath, file.buffer, file.mimetype);
      storedReference = uploaded.publicUrl;
    } else {
      await storageService.uploadPrivate(objectPath, file.buffer, file.mimetype);
    }

    return await this.materialRepo.createFile({
      carpeta_id: Number(carpetaId),
      nombre_original: file.originalname,
      nombre_almacenado: storedReference,
      tipo_mime: file.mimetype,
      tamano_bytes: file.size,
      categoria: categoria || 'FICHA_TRABAJO',
      descripcion: descripcion ? descripcion.trim() : null,
      es_publico: isPublic ? 1 : 0,
      subido_por_usuario_id: userId
    });
  }

  async getFileForView(id, currentUser) {
    const file = await this.materialRepo.getFileById(id);
    if (!file) {
      throw AppError.notFound(`El archivo con ID [${id}] no existe.`);
    }

    if (Number(file.es_publico) === 0) {
      const isOwner = Number(file.subido_por_usuario_id) === Number(currentUser?.id);
      const isAdmin = currentUser?.rol === 'ADMIN';
      if (!isOwner && !isAdmin) {
        throw AppError.forbidden('No tienes permisos para acceder a este material privado.');
      }
    }

    return file;
  }

  async deleteFile(id, userId, userRole) {
    const file = await this.materialRepo.getFileById(id);
    if (!file) {
      throw new Error(`El archivo con ID [${id}] no existe.`);
    }

    // Regla de Propiedad Estricta: Solo el autor que subió el archivo o el Administrador pueden eliminarlo
    const isOwner = Number(file.subido_por_usuario_id) === Number(userId);
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new Error('Permiso denegado. Solo el especialista que subió este material o la Dirección General pueden eliminarlo.');
    }

    const bucket = Number(file.es_publico) === 0 ? PRIVATE_BUCKET : PUBLIC_BUCKET;
    const key = extractStorageKey(file.nombre_almacenado, 'materiales', bucket);
    if (key) {
      await storageService.deleteObject(bucket, key);
    }

    return await this.materialRepo.deleteFile(id);
  }

  async recordDownload(id) {
    return await this.materialRepo.incrementDownloads(id);
  }
}

export const materialService = new MaterialService();
