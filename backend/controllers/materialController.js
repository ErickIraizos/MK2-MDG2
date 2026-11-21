import { materialService } from '../services/materialService.js';
import { storageService, PUBLIC_BUCKET, PRIVATE_BUCKET, extractStorageKey } from '../services/storageService.js';

export class MaterialController {
  static async getFolders(req, res, next) {
    try {
      const { scope } = req.query; // 'public' | 'private' | 'all'
      const folders = await materialService.getFolders(false, scope || 'public', req.user?.id);
      return res.status(200).json({
        success: true,
        data: folders
      });
    } catch (err) {
      next(err);
    }
  }

  static async getFolderById(req, res, next) {
    try {
      const { id } = req.params;
      const folder = await materialService.getFolderById(Number(id));
      return res.status(200).json({
        success: true,
        data: folder
      });
    } catch (err) {
      next(err);
    }
  }

  static async createFolder(req, res, next) {
    try {
      const { nombre, descripcion, color, icono, es_publico } = req.body;
      const folder = await materialService.createFolder({ nombre, descripcion, color, icono, es_publico }, req.user.id);
      return res.status(201).json({
        success: true,
        message: 'Carpeta de materiales creada exitosamente.',
        data: folder
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateFolder(req, res, next) {
    try {
      const { id } = req.params;
      const { nombre, descripcion, color, icono } = req.body;
      const folder = await materialService.updateFolder(Number(id), { nombre, descripcion, color, icono });
      return res.status(200).json({
        success: true,
        message: 'Carpeta actualizada exitosamente.',
        data: folder
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteFolder(req, res, next) {
    try {
      const { id } = req.params;
      await materialService.deleteFolder(Number(id));
      return res.status(200).json({
        success: true,
        message: 'Carpeta archivada exitosamente.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async getFiles(req, res, next) {
    try {
      const { folderId } = req.params;
      const { search, scope } = req.query; // 'public' | 'private' | 'all'
      const files = await materialService.getFiles(Number(folderId), search, scope || 'public', req.user?.id);
      return res.status(200).json({
        success: true,
        data: files
      });
    } catch (err) {
      next(err);
    }
  }

  static async uploadFile(req, res, next) {
    try {
      const { carpetaId, categoria, descripcion, es_publico } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'FILE_REQUIRED', message: 'Debe adjuntar un archivo para subir al repositorio.' }
        });
      }

      const fileRecord = await materialService.saveFile({
        file,
        carpetaId: Number(carpetaId),
        categoria,
        descripcion,
        es_publico: es_publico !== undefined ? Number(es_publico) : 1,
        userId: req.user.id
      });

      return res.status(201).json({
        success: true,
        message: 'Archivo subido al repositorio de materiales exitosamente.',
        data: fileRecord
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteFile(req, res, next) {
    try {
      const { id } = req.params;
      await materialService.deleteFile(Number(id), req.user.id, req.user.rol);
      return res.status(200).json({
        success: true,
        message: 'Archivo eliminado del repositorio.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async viewFile(req, res, next) {
    try {
      const { id } = req.params;
      const downloadFlag = req.query.download === '1';
      const file = await materialService.getFileForView(Number(id), req.user);
      const isPrivate = Number(file.es_publico) === 0;
      const bucket = isPrivate ? PRIVATE_BUCKET : PUBLIC_BUCKET;
      const key = extractStorageKey(file.nombre_almacenado, 'materiales', bucket);

      if (req.headers.authorization) {
        const buffer = await storageService.downloadBuffer(bucket, key);
        const disposition = downloadFlag ? 'attachment' : 'inline';
        res.setHeader('Content-Type', file.tipo_mime || 'application/octet-stream');
        res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(file.nombre_original || 'material')}"`);
        return res.send(buffer);
      }

      if (isPrivate) {
        const signedUrl = await storageService.createSignedUrl(
          PRIVATE_BUCKET,
          key,
          60,
          downloadFlag ? { download: file.nombre_original || true } : {}
        );
        return res.redirect(302, signedUrl);
      }

      if (String(file.nombre_almacenado).startsWith('http') && !downloadFlag) {
        return res.redirect(302, file.nombre_almacenado);
      }

      const publicUrl = storageService.getPublicUrl(key, PUBLIC_BUCKET);
      return res.redirect(302, downloadFlag ? `${publicUrl}?download=${encodeURIComponent(file.nombre_original || '')}` : publicUrl);
    } catch (err) {
      next(err);
    }
  }

  static async recordDownload(req, res, next) {
    try {
      const { id } = req.params;
      await materialService.recordDownload(Number(id));
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
