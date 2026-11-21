import { ClinicalRecordService } from '../services/clinicalRecordService.js';
import { storageService, PRIVATE_BUCKET } from '../services/storageService.js';

const service = new ClinicalRecordService();

export class ClinicalRecordController {
  static async getHistories(req, res, next) {
    try {
      const { search, estado, terapeutaId, limit, offset, soloAsignados } = req.query;
      const result = await service.getAllHistories(
        { search, estado, terapeutaId, limit, offset, soloAsignados },
        req.user
      );

      res.status(200).json({
        success: true,
        data: result.records,
        meta: {
          total: result.total,
          limit: Number(limit) || 50,
          offset: Number(offset) || 0
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getHistoryById(req, res, next) {
    try {
      const { id } = req.params;
      const data = await service.getHistoryById(Number(id), req.user);

      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async getHistoryByPatient(req, res, next) {
    try {
      const { patientId } = req.params;
      const data = await service.getHistoryByPatientId(Number(patientId), req.user);

      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { estado, observaciones } = req.body;
      const updated = await service.updateHistoryStatus(Number(id), { estado, observaciones }, req.user);

      res.status(200).json({
        success: true,
        message: 'Estado de la historia clínica actualizado correctamente.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async saveAnamnesis(req, res, next) {
    try {
      const { id } = req.params;
      const saved = await service.saveAnamnesis(Number(id), req.body, req.user);

      res.status(200).json({
        success: true,
        message: 'Anamnesis clínica registrada correctamente.',
        data: saved
      });
    } catch (err) {
      next(err);
    }
  }

  static async createSoap(req, res, next) {
    try {
      const { id } = req.params;
      const notePayload = {
        ...req.body,
        historiaId: Number(id)
      };

      const note = await service.createSoapNote(notePayload, req.user);

      res.status(201).json({
        success: true,
        message: 'Nota de evolución SOAP registrada y sellada con éxito (RN-07).',
        data: note
      });
    } catch (err) {
      next(err);
    }
  }

  static async assistSoap(req, res, next) {
    try {
      const { roughNotes, patientContext, areaClinica } = req.body;
      const result = await service.assistSoapWithAi(
        { roughNotes, patientContext, areaClinica },
        req.user
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // SPRINT 5: CATÁLOGO NOSOLÓGICO, CARPETAS DIGITALES Y PLANES SMART
  // =========================================================================

  static async searchDiagnostics(req, res, next) {
    try {
      const { q, categoria } = req.query;
      const results = await service.searchDiagnostics({ query: q, categoria });
      res.status(200).json({
        success: true,
        data: results
      });
    } catch (err) {
      next(err);
    }
  }

  static async getPatientFolders(req, res, next) {
    try {
      const { patientId } = req.params;
      const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
      const folders = await service.getPatientFolders(Number(patientId), req.user, includeInactive);
      res.status(200).json({
        success: true,
        data: folders
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateFolderStatus(req, res, next) {
    try {
      const { patientId, folderId } = req.params;
      const { activo, motivo_baja } = req.body;
      const updated = await service.updateFolderStatus(
        Number(patientId),
        Number(folderId),
        activo,
        req.user,
        motivo_baja
      );
      res.status(200).json({
        success: true,
        message: `Carpeta ${activo ? 'reactivada' : 'desactivada'} exitosamente.`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async createPatientFolder(req, res, next) {
    try {
      const { patientId } = req.params;
      const folder = await service.createPatientFolder(Number(patientId), req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Carpeta digital creada exitosamente.',
        data: folder
      });
    } catch (err) {
      next(err);
    }
  }

  static async getPatientDocuments(req, res, next) {
    try {
      const { patientId } = req.params;
      const { carpetaId } = req.query;
      const documents = await service.getPatientDocuments(
        Number(patientId),
        { carpetaId: carpetaId ? Number(carpetaId) : null },
        req.user
      );
      res.status(200).json({
        success: true,
        data: documents
      });
    } catch (err) {
      next(err);
    }
  }

  static async viewDocument(req, res, next) {
    try {
      const { docId } = req.params;
      const { download } = req.query;
      const downloadFlag = download === '1';
      const { document, objectKey } = await service.getDocumentForView(Number(docId), req.user);

      if (req.headers.authorization) {
        const buffer = await storageService.downloadBuffer(PRIVATE_BUCKET, objectKey);
        const disposition = downloadFlag ? 'attachment' : 'inline';
        res.setHeader('Content-Type', document.tipo_mime || 'application/octet-stream');
        res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(document.nombre_original || 'documento.pdf')}"`);
        return res.send(buffer);
      }

      const signedUrl = await storageService.createSignedUrl(
        PRIVATE_BUCKET,
        objectKey,
        60,
        downloadFlag ? { download: document.nombre_original || true } : {}
      );
      return res.redirect(302, signedUrl);
    } catch (err) {
      next(err);
    }
  }

  static async uploadPatientDocument(req, res, next) {
    try {
      const { patientId } = req.params;
      const doc = await service.uploadPatientDocument(Number(patientId), req.file, req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Estudio o documento clínico adjuntado correctamente.',
        data: doc
      });
    } catch (err) {
      next(err);
    }
  }

  static async softDeleteDocument(req, res, next) {
    try {
      const { docId } = req.params;
      const motivoAnulacion = req.body?.motivoAnulacion || req.body?.motivo_anulacion || req.body?.motivo || req.body?.motivo_baja || req.query?.motivoAnulacion || req.query?.motivo;
      const result = await service.softDeletePatientDocument(Number(docId), { motivoAnulacion }, req.user);
      res.status(200).json({
        success: true,
        message: 'Documento clínico archivado con justificación médica.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async restoreDocument(req, res, next) {
    try {
      const { docId } = req.params;
      const result = await service.restorePatientDocument(Number(docId), req.user);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async getInactiveDocuments(req, res, next) {
    try {
      const { patientId } = req.params;
      const documents = await service.getInactiveDocuments(Number(patientId), req.user);
      res.status(200).json({
        success: true,
        data: documents
      });
    } catch (err) {
      next(err);
    }
  }

  static async getInterventionPlans(req, res, next) {
    try {
      const { historyId } = req.params;
      const plans = await service.getInterventionPlans(Number(historyId), req.user);
      res.status(200).json({
        success: true,
        data: plans
      });
    } catch (err) {
      next(err);
    }
  }

  static async getFamilyPlansForTutor(req, res, next) {
    try {
      const familyPlans = await service.getFamilyPlansForTutor(req.user);
      res.status(200).json({
        success: true,
        data: familyPlans
      });
    } catch (err) {
      next(err);
    }
  }

  static async getInterventionPlanById(req, res, next) {
    try {
      const { planId } = req.params;
      const plan = await service.getInterventionPlanById(Number(planId), req.user);
      res.status(200).json({
        success: true,
        data: plan
      });
    } catch (err) {
      next(err);
    }
  }

  static async createInterventionPlan(req, res, next) {
    try {
      const { historyId } = req.params;
      const plan = await service.createInterventionPlan(Number(historyId), req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Plan Terapéutico Individualizado (PTI) creado exitosamente.',
        data: plan
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateInterventionPlanStatus(req, res, next) {
    try {
      const { planId } = req.params;
      const { estado, motivoCierre } = req.body;
      const updated = await service.updateInterventionPlanStatus(Number(planId), { estado, motivoCierre }, req.user);
      res.status(200).json({
        success: true,
        message: `Plan terapéutico actualizado a estado [${estado}].`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async addSmartGoal(req, res, next) {
    try {
      const { planId } = req.params;
      const goal = await service.addSmartGoal(Number(planId), req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Meta SMART registrada exitosamente.',
        data: goal
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateSmartGoalProgress(req, res, next) {
    try {
      const { metaId } = req.params;
      const updated = await service.updateSmartGoalProgress(Number(metaId), req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Avance de meta SMART actualizado con trazabilidad clínica.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async getGoalHistory(req, res, next) {
    try {
      const { metaId } = req.params;
      const history = await service.getGoalHistory(Number(metaId), req.user);
      res.status(200).json({
        success: true,
        data: history
      });
    } catch (err) {
      next(err);
    }
  }

  static async recordHomePracticeCheckin(req, res, next) {
    try {
      const { metaId, pacienteId, nivelRespuesta, observacionHogar } = req.body;
      const result = await service.recordHomePracticeCheckin(
        { metaId, pacienteId, nivelRespuesta, observacionHogar },
        req.user
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getHomePracticeHistory(req, res, next) {
    try {
      const { patientId } = req.params;
      const { metaId } = req.query;
      const history = await service.getHomePracticeHistory(Number(patientId), req.user, metaId ? Number(metaId) : null);
      res.status(200).json({
        success: true,
        data: history
      });
    } catch (err) {
      next(err);
    }
  }
}

