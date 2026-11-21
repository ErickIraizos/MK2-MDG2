import path from 'path';
import { DocumentReportService } from '../services/documentReportService.js';
import { storageService, PRIVATE_BUCKET } from '../services/storageService.js';

const reportService = new DocumentReportService();

export class DocumentReportController {
  static async createReport(req, res, next) {
    try {
      const report = await reportService.createReport(req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Informe clínico compilado y registrado exitosamente.',
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReportById(req, res, next) {
    try {
      const { id } = req.params;
      const report = await reportService.getReportById(Number(id), req.user);
      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReportsByPatient(req, res, next) {
    try {
      const { patientId } = req.params;
      const isTutor = req.user?.rol === 'TUTOR';
      const options = {
        soloEntregables: isTutor
      };
      const reports = await reportService.getReportsByPatient(Number(patientId), options, req.user);
      res.status(200).json({
        success: true,
        data: reports
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateReport(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await reportService.updateReport(Number(id), req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Informe clínico actualizado exitosamente.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteReport(req, res, next) {
    try {
      const { id } = req.params;
      await reportService.deleteReport(Number(id), req.user);
      res.status(200).json({
        success: true,
        message: 'Informe clínico eliminado.'
      });
    } catch (error) {
      next(error);
    }
  }

  static async downloadDocx(req, res, next) {
    try {
      const { id } = req.params;
      const { buffer, filename } = await reportService.getDocxBuffer(Number(id), req.user);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async uploadSignedDocument(req, res, next) {
    try {
      const { id } = req.params;
      const result = await reportService.uploadSignedDocument(Number(id), req.file, req.user);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async downloadSignedDocument(req, res, next) {
    try {
      const { id } = req.params;
      const { objectKey, report } = await reportService.getSignedDocument(Number(id), req.user);
      const ext = path.extname(objectKey).replace('.', '') || 'pdf';
      const cleanFileName = `PSI_Aprende_Informe_Firmado_${report.paciente_codigo || 'EXP'}_${report.id}.${ext}`;

      if (req.headers.authorization) {
        const buffer = await storageService.downloadBuffer(PRIVATE_BUCKET, objectKey);
        res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}"`);
        return res.send(buffer);
      }

      const signedUrl = await storageService.createSignedUrl(PRIVATE_BUCKET, objectKey, 60, {
        download: cleanFileName
      });
      return res.redirect(302, signedUrl);
    } catch (error) {
      next(error);
    }
  }

  static async stampSignature(req, res, next) {
    try {
      const { id } = req.params;
      const result = await reportService.stampTherapistSignature(Number(id), req.user);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
