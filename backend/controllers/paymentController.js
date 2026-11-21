import path from 'path';
import { PaymentService } from '../services/paymentService.js';
import { AppError } from '../core/AppError.js';
import { parseBase64Image } from '../utils/fileValidator.js';
import { storageService, PRIVATE_BUCKET, extractStorageKey } from '../services/storageService.js';

const paymentService = new PaymentService();

export class PaymentController {
  static async getPayments(req, res, next) {
    try {
      const payments = await paymentService.getPayments(req.user, req.query);
      res.status(200).json({
        success: true,
        data: payments
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentById(req, res, next) {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(Number(id), req.user);
      res.status(200).json({
        success: true,
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  static async ensurePayment(req, res, next) {
    try {
      const { appointmentId } = req.params;
      const payment = await paymentService.ensurePaymentForAppointment(Number(appointmentId), req.user);
      res.status(200).json({
        success: true,
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadReceipt(req, res, next) {
    try {
      const { id } = req.params;
      let fileUrl = null;
      let fileType = null;

      if (req.file) {
        const objectPath = `receipts/${storageService.buildSafeFilename('comprobante', req.file.originalname)}`;
        await storageService.uploadPrivate(objectPath, req.file.buffer, req.file.mimetype);
        fileUrl = objectPath;
        fileType = req.file.mimetype;
      } else if (req.body.comprobante_base64) {
        const { mimetype, buffer } = parseBase64Image(req.body.comprobante_base64, 4 * 1024 * 1024);
        const ext = mimetype.split('/')[1] === 'jpeg' ? 'jpg' : mimetype.split('/')[1];
        const objectPath = `receipts/${storageService.buildSafeFilename('comprobante', `receipt.${ext}`)}`;
        await storageService.uploadPrivate(objectPath, buffer, mimetype);
        fileUrl = objectPath;
        fileType = mimetype;
      } else {
        throw AppError.badRequest('Debe adjuntar una imagen o documento de comprobante de pago.');
      }

      const updated = await paymentService.uploadReceipt(
        Number(id),
        {
          fileUrl,
          fileType,
          numeroTransaccion: req.body.numero_transaccion,
          observaciones: req.body.observaciones
        },
        req.user
      );

      res.status(200).json({
        success: true,
        message: '¡Comprobante de pago subido exitosamente! Queda en revisión para su validación.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyPayment(req, res, next) {
    try {
      const { id } = req.params;
      const { estado, observaciones, motivo_rechazo } = req.body;

      const updated = await paymentService.verifyPayment(
        Number(id),
        {
          estado: estado || 'VERIFICADO',
          observaciones,
          motivoRechazo: motivo_rechazo
        },
        req.user
      );

      res.status(200).json({
        success: true,
        message: estado === 'VERIFICADO' 
          ? '¡Pago verificado y acreditado exitosamente!' 
          : 'Comprobante rechazado.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async registerCashPayment(req, res, next) {
    try {
      const { appointmentId } = req.params;
      const { monto, observaciones } = req.body;

      const payment = await paymentService.registerCashPayment(
        Number(appointmentId),
        { monto, observaciones },
        req.user
      );

      res.status(201).json({
        success: true,
        message: 'Cobro en efectivo registrado y verificado correctamente.',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCashSummary(req, res, next) {
    try {
      const summary = await paymentService.getCashSummary(req.user, req.query);
      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  static async getQrConfig(req, res, next) {
    try {
      const config = await paymentService.getQrConfig();
      res.status(200).json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateQrConfig(req, res, next) {
    try {
      const updated = await paymentService.updateQrConfig(req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Datos y parámetros de pago QR actualizados correctamente.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadQrImage(req, res, next) {
    try {
      if (!req.file) {
        throw AppError.badRequest('No se adjuntó ningún archivo de imagen para el QR oficial.');
      }

      const objectPath = `qr/${storageService.buildSafeFilename('qr_institucional', req.file.originalname)}`;
      const uploaded = await storageService.uploadPublic(objectPath, req.file.buffer, req.file.mimetype);
      const qrImageUrl = uploaded.publicUrl;
      const configData = {
        qr_imagen: qrImageUrl,
        banco_nombre: req.body.banco_nombre,
        cuenta_titular: req.body.cuenta_titular,
        cuenta_numero: req.body.cuenta_numero,
        instrucciones: req.body.instrucciones
      };

      const updated = await paymentService.updateQrConfig(configData, req.user);

      res.status(200).json({
        success: true,
        message: 'Imagen del QR oficial del centro actualizada con éxito.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async viewReceipt(req, res, next) {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(Number(id), req.user);

      if (!payment.comprobante_url) {
        throw AppError.notFound('El pago no cuenta con un archivo de comprobante adjunto.');
      }

      // Si es un data URI base64 legacy
      if (payment.comprobante_url.startsWith('data:')) {
        const matches = payment.comprobante_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const type = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', type);
          return res.send(buffer);
        }
      }

      const objectKey = extractStorageKey(payment.comprobante_url, 'receipts', PRIVATE_BUCKET);
      if (!objectKey) {
        throw AppError.notFound('El archivo físico del comprobante no existe en el almacenamiento.');
      }

      if (req.headers.authorization) {
        const buffer = await storageService.downloadBuffer(PRIVATE_BUCKET, objectKey);
        const ext = path.extname(objectKey).toLowerCase();
        const fallbackMime = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg'));
        res.setHeader('Content-Type', payment.comprobante_tipo || fallbackMime);
        res.setHeader('Content-Disposition', 'inline');
        return res.send(buffer);
      }

      const signedUrl = await storageService.createSignedUrl(PRIVATE_BUCKET, objectKey, 60);
      return res.redirect(302, signedUrl);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // CONTROLADOR DE TARIFARIO Y QR DE ESPECIALISTA
  // =========================================================================
  static async getTherapistPaymentConfig(req, res, next) {
    try {
      const { therapistId } = req.params;
      const isTutor = req.user?.rol === 'TUTOR';
      const config = await paymentService.getTherapistPaymentConfig(Number(therapistId), isTutor);
      res.status(200).json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyTherapistPaymentConfig(req, res, next) {
    try {
      const config = await paymentService.getMyTherapistPaymentConfig(req.user);
      res.status(200).json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMyTherapistPaymentConfig(req, res, next) {
    try {
      const config = await paymentService.updateMyTherapistPaymentConfig(req.user, req.body);
      res.status(200).json({
        success: true,
        message: '¡Tarifario clínico y datos bancarios actualizados correctamente!',
        data: config
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadTherapistQr(req, res, next) {
    try {
      if (!req.file) {
        throw AppError.badRequest('Debe adjuntar una imagen válida para su código QR personal.');
      }
      const objectPath = `qr/${storageService.buildSafeFilename(`qr_terapeuta_${req.user.id}`, req.file.originalname)}`;
      const uploaded = await storageService.uploadPublic(objectPath, req.file.buffer, req.file.mimetype);
      const qrUrl = uploaded.publicUrl;
      const qr_fecha_vencimiento = req.body?.qr_fecha_vencimiento || null;
      const config = await paymentService.uploadTherapistQr(req.user, qrUrl, qr_fecha_vencimiento);
      res.status(200).json({
        success: true,
        message: '¡Código QR personal del especialista subido y guardado exitosamente!',
        data: config
      });
    } catch (error) {
      next(error);
    }
  }

  static async createPaymentRequest(req, res, next) {
    try {
      const payment = await paymentService.createPaymentRequest(req.user, req.body);
      res.status(201).json({
        success: true,
        message: '¡Orden de cobro emitida y habilitada para el tutor exitosamente!',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }
}
