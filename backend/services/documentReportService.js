import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  HeadingLevel,
  WidthType,
  BorderStyle,
  ImageRun,
  Packer
} from 'docx';
import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';
import { assertPatientAccess } from '../core/accessControl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.resolve(__dirname, '../uploads/reports');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export class DocumentReportService {
  constructor() {
    this.reportRepo = RepositoryFactory.getReportRepository();
    this.patientRepo = RepositoryFactory.getPatientRepository();
    this.clinicalRecordRepo = RepositoryFactory.getClinicalRecordRepository();
    this.therapistRepo = RepositoryFactory.getTherapistRepository();
    this.userRepo = RepositoryFactory.getUserRepository();
    this.configRepo = RepositoryFactory.getConfigRepository();
  }

  async createReport(data, currentUser = null) {
    const {
      paciente_id,
      historia_id,
      terapeuta_id,
      tipo_informe,
      titulo,
      motivo_evaluacion,
      motivo_consulta,
      antecedentes_relevantes,
      baterias_administradas,
      baterias_aplicadas,
      resultados_cuantitativos,
      interpretacion_resultados,
      conclusiones_cualitativas,
      conclusiones_diagnosticas,
      diagnostico_codigo,
      diagnostico_descripcion,
      recomendaciones_colegio,
      recomendaciones_familia,
      plan_recomendaciones,
      entregable_familiar,
      estado
    } = data;

    if (!paciente_id) {
      throw new AppError('El ID del paciente es obligatorio para generar el informe', 400, 'VALIDATION_ERROR');
    }

    const patient = await this.patientRepo.findById(paciente_id);
    if (!patient) {
      throw new AppError(`Paciente con ID ${paciente_id} no encontrado`, 404, 'NOT_FOUND');
    }

    if (currentUser) {
      await assertPatientAccess(paciente_id, currentUser, {
        allowReception: false,
        allowTutor: false,
        actionDescription: 'redactar o emitir informes clínicos de este paciente'
      });
    }

    // Resolver historia clínica si no se especifica
    let finalHistoriaId = historia_id;
    if (!finalHistoriaId) {
      const history = await this.clinicalRecordRepo.findHistoryByPatientId(paciente_id);
      if (history) {
        finalHistoriaId = history.id;
      } else {
        throw new AppError('El paciente no cuenta con una historia clínica abierta para vincular el informe', 400, 'HISTORY_REQUIRED');
      }
    }

    // Resolver terapeuta
    let finalTerapeutaId = terapeuta_id;
    if (!finalTerapeutaId && currentUser) {
      const therapist = await this.therapistRepo.findByUserId(currentUser.id);
      if (therapist) {
        finalTerapeutaId = therapist.id;
      } else if (patient.terapeuta_id) {
        finalTerapeutaId = patient.terapeuta_id;
      } else {
        finalTerapeutaId = 1; // Default institucional
      }
    }

    const titleMap = {
      'EVALUACION_NEUROPSICOLOGICA': 'INFORME DE EVALUACIÓN NEUROPSICOLÓGICA CLÍNICA',
      'INFORME_PSICOPEDAGOGICO': 'INFORME DE VALORACIÓN PSICOPEDAGÓGICA Y DEL APRENDIZAJE',
      'VALORACION_GERONTOLOGICA': 'INFORME DE VALORACIÓN NEUROCOGNITIVA GERONTOLÓGICA',
      'EVOLUCION_CLINICA': 'INFORME DE PROGRESO Y EVOLUCIÓN TERAPÉUTICA',
      'INFORME_ESCOLAR': 'DICTAMEN CLÍNICO Y ORIENTACIONES PSICOPEDAGÓGICAS ESCOLARES'
    };

    const finalTitle = titulo || titleMap[tipo_informe] || 'INFORME CLÍNICO INSTITUCIONAL';
    const finalBaterias = baterias_administradas || baterias_aplicadas || [];
    const finalMotivo = motivo_evaluacion || motivo_consulta || '';
    const finalResultados = resultados_cuantitativos || interpretacion_resultados || '';
    const finalConclusiones = conclusiones_cualitativas || conclusiones_diagnosticas || '';
    const finalRecomColegio = recomendaciones_colegio || plan_recomendaciones || '';
    const finalRecomFamilia = recomendaciones_familia || '';

    // 1. Guardar informe base en base de datos
    const report = await this.reportRepo.createReport({
      paciente_id,
      historia_id: finalHistoriaId,
      terapeuta_id: finalTerapeutaId,
      tipo_informe: tipo_informe || 'EVALUACION_NEUROPSICOLOGICA',
      titulo: finalTitle,
      motivo_evaluacion: finalMotivo,
      antecedentes_relevantes,
      baterias_administradas: finalBaterias,
      resultados_cuantitativos: finalResultados,
      conclusiones_cualitativas: finalConclusiones,
      diagnostico_codigo,
      diagnostico_descripcion,
      recomendaciones_colegio: finalRecomColegio,
      recomendaciones_familia: finalRecomFamilia,
      entregable_familiar: entregable_familiar ? 1 : 0,
      estado: estado || 'EMITIDO'
    });

    // 2. Compilar el archivo .docx automáticamente con diseño editorial
    const docxPath = await this._compileDocx(report);

    // 3. Actualizar la ruta generada
    await this.reportRepo.updateDocxPath(report.id, docxPath);
    report.ruta_docx = docxPath;

    return report;
  }

  async getReportById(id, currentUser = null) {
    const report = await this.reportRepo.findById(id);
    if (!report) {
      throw new AppError(`Informe clínico con ID ${id} no encontrado`, 404, 'NOT_FOUND');
    }
    if (currentUser) {
      await assertPatientAccess(report.paciente_id, currentUser, {
        allowReception: true,
        allowTutor: true,
        actionDescription: 'acceder a este informe clínico'
      });
      if (currentUser.rol === 'TUTOR' && !report.entregable_familiar) {
        throw new AppError('Este informe es de uso clínico interno y aún no está habilitado para entrega familiar.', 403, 'FORBIDDEN');
      }
    }
    return report;
  }

  async getReportsByPatient(patientId, options = {}, currentUser = null) {
    if (!patientId) {
      throw new AppError('ID de paciente requerido', 400, 'VALIDATION_ERROR');
    }
    if (currentUser) {
      await assertPatientAccess(patientId, currentUser, {
        allowReception: true,
        allowTutor: true,
        actionDescription: 'consultar los informes clínicos de este paciente'
      });
    }
    return this.reportRepo.findByPatientId(patientId, options);
  }

  async getReportsByTherapist(therapistId) {
    if (!therapistId) {
      throw new AppError('ID de terapeuta requerido', 400, 'VALIDATION_ERROR');
    }
    return this.reportRepo.findByTherapistId(therapistId);
  }

  async updateReport(id, data, currentUser = null) {
    const existing = await this.getReportById(id, currentUser);
    if (existing.estado === 'ARCHIVADO') {
      throw new AppError('No se puede modificar un informe clínico archivado', 400, 'REPORT_ARCHIVED');
    }

    const updated = await this.reportRepo.updateReport(id, data);
    
    // Recompilar archivo docx con los nuevos datos
    const docxPath = await this._compileDocx(updated);
    await this.reportRepo.updateDocxPath(id, docxPath);
    updated.ruta_docx = docxPath;

    return updated;
  }

  async deleteReport(id, currentUser = null) {
    const existing = await this.getReportById(id, currentUser);
    if (existing.estado === 'EMITIDO' && currentUser?.rol !== 'ADMIN') {
      throw new AppError('Solo un administrador puede eliminar un informe emitido formalmente', 403, 'FORBIDDEN');
    }

    // Eliminar archivo físico si existe
    if (existing.ruta_docx && fs.existsSync(existing.ruta_docx)) {
      try {
        fs.unlinkSync(existing.ruta_docx);
      } catch (e) {}
    }

    return this.reportRepo.deleteReport(id);
  }

  async uploadSignedDocument(id, file, currentUser = null) {
    const report = await this.getReportById(id, currentUser);
    if (!file || !file.path) {
      throw new AppError('No se recibió ningún archivo firmado válido', 400, 'FILE_REQUIRED');
    }

    await this.reportRepo.updateReport(id, { 
      ruta_archivo_firmado: file.path,
      estado: 'FIRMADO' 
    });

    return {
      success: true,
      message: 'Informe firmado adjuntado con éxito al expediente',
      reportId: id,
      ruta: file.path
    };
  }

  async stampTherapistSignature(id, currentUser = null) {
    const report = await this.getReportById(id, currentUser);
    if (!report) {
      throw new AppError('Informe clínico no encontrado', 404, 'NOT_FOUND');
    }

    let signatureBlob = null;
    let therapist = null;

    if (currentUser?.id) {
      therapist = await this.therapistRepo.findByUserId(currentUser.id);
      if (therapist?.firma_digital_blob) {
        signatureBlob = therapist.firma_digital_blob;
      }
      if (!signatureBlob && currentUser.firma_digital_blob) {
        signatureBlob = currentUser.firma_digital_blob;
      }
      if (!signatureBlob) {
        const u = await this.userRepo.findById(currentUser.id);
        if (u?.firma_digital_blob) {
          signatureBlob = u.firma_digital_blob;
        }
      }
    }

    if (!signatureBlob && report.terapeuta_id) {
      const th = await this.therapistRepo.findById(report.terapeuta_id);
      if (th?.firma_digital_blob) {
        signatureBlob = th.firma_digital_blob;
      } else if (th?.usuario_id) {
        const u = await this.userRepo.findById(th.usuario_id);
        if (u?.firma_digital_blob) {
          signatureBlob = u.firma_digital_blob;
        }
      }
    }

    if (!signatureBlob) {
      throw new AppError(
        'No tienes una firma digital registrada en tu perfil. Por favor, ve a tu Perfil de Terapeuta para registrar tu rúbrica antes de estampar informes.',
        400,
        'SIGNATURE_NOT_CONFIGURED'
      );
    }

    report.firma_digital_blob = signatureBlob;
    report.estado = 'FIRMADO';
    report.estampar_firma = true;

    const newDocxPath = await this._compileDocx(report);
    await this.reportRepo.updateDocxPath(id, newDocxPath);
    await this.reportRepo.updateReport(id, {
      estado: 'FIRMADO',
      ruta_docx: newDocxPath
    });

    return {
      success: true,
      message: 'Firma digital colegiada estampada con éxito en el informe oficial.',
      reportId: id,
      estado: 'FIRMADO',
      ruta_docx: newDocxPath
    };
  }

  async getSignedDocument(id, currentUser = null) {
    const report = await this.getReportById(id, currentUser);
    if (!report.ruta_archivo_firmado || !fs.existsSync(report.ruta_archivo_firmado)) {
      throw new AppError('No se encontró el documento firmado escaneado en el servidor', 404, 'NOT_FOUND');
    }
    return {
      filePath: report.ruta_archivo_firmado,
      report
    };
  }

  async getDocxBuffer(id, currentUser = null) {
    const report = await this.getReportById(id, currentUser);
    let filePath = report.ruta_docx;
    if (!filePath || !fs.existsSync(filePath)) {
      // Si el archivo físico no existe, recompilar en caliente
      filePath = await this._compileDocx(report);
      await this.reportRepo.updateDocxPath(id, filePath);
    }

    return {
      buffer: fs.readFileSync(filePath),
      filename: `PSI_Aprende_Informe_${report.paciente_codigo || 'EXP'}_${report.id}.docx`,
      report
    };
  }

  /**
   * Compilador de diseño editorial oficial en Microsoft Word OpenXML (.docx)
   * Adaptable a: Niños (Pediatría), Adolescentes, Adultos y Adultos Mayores (Gerontología)
   */
  async _compileDocx(report) {
    if (!report) {
      throw new AppError('Informe no encontrado', 404, 'NOT_FOUND');
    }

    const ageInfo = this._parseAge(report.paciente_fecha_nacimiento);
    const dateFormatted = new Date(report.fecha_emision || Date.now()).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const isAdult = ageInfo.years >= 18;
    const isElderly = ageInfo.years >= 60;

    // Cargar parámetros institucionales dinámicos de sede
    let instNombre = 'Centro Psicopedagógico y de Atención Psicológica "PSI Aprende"';
    let instDireccion = 'Cochabamba, Bolivia';
    let instTelefono = '+591 4 4521234';
    let instDirectora = 'Mgr. Grisel Aguilar Apaza';
    try {
      if (this.configRepo) {
        instNombre = (await this.configRepo.getByKey('INSTITUCION_NOMBRE')) || instNombre;
        instDireccion = (await this.configRepo.getByKey('INSTITUCION_DIRECCION')) || instDireccion;
        instTelefono = (await this.configRepo.getByKey('INSTITUCION_TELEFONO')) || instTelefono;
        instDirectora = (await this.configRepo.getByKey('INSTITUCION_DIRECTORA')) || instDirectora;
      }
    } catch (cErr) {
      console.warn('[Docx] No se pudieron cargar configuraciones de sede:', cErr.message);
    }

    // Resolver firma digital del terapeuta si corresponde
    let signatureBlob = report.firma_digital_blob || report.terapeuta_firma_digital || null;
    if (!signatureBlob && report.terapeuta_id) {
      try {
        const th = await this.therapistRepo.findById(report.terapeuta_id);
        if (th?.firma_digital_blob) {
          signatureBlob = th.firma_digital_blob;
        } else if (th?.usuario_id) {
          const u = await this.userRepo.findById(th.usuario_id);
          if (u?.firma_digital_blob) {
            signatureBlob = u.firma_digital_blob;
          }
        }
      } catch (thErr) {
        console.warn('[Docx] No se pudo obtener firma del terapeuta:', thErr.message);
      }
    }

    const isSignedDoc = report.estado === 'FIRMADO' || Boolean(report.estampar_firma);
    const signatureCellChildren = [];

    if (signatureBlob && isSignedDoc) {
      try {
        const cleanBase64 = signatureBlob.replace(/^data:image\/\w+;base64,/, '');
        const sigBuffer = Buffer.from(cleanBase64, 'base64');
        signatureCellChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 15 },
            children: [
              new ImageRun({
                data: sigBuffer,
                transformation: {
                  width: 140,
                  height: 40
                }
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 20 },
            children: [
              new TextRun({
                text: '✓ FIRMADO DIGITALMENTE · ACREDITACIÓN PROFESIONAL CPB',
                bold: true,
                size: 13,
                color: '0F766E'
              })
            ]
          })
        );
      } catch (err) {
        console.warn('[Docx] Error insertando imagen de firma digital:', err.message);
      }
    }

    signatureCellChildren.push(
      new Paragraph({
        text: '________________________________________',
        alignment: AlignmentType.CENTER,
        spacing: { before: signatureCellChildren.length > 0 ? 30 : 540 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Lic. ${report.terapeuta_nombres || ''} ${report.terapeuta_apellidos || ''}`,
            bold: true,
            size: 19,
            color: '27345F'
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Especialista en ${report.terapeuta_especialidad || 'Neuropsicología y Psicología Clínica'}`,
            size: 16,
            color: '584294'
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Colegio de Psicólogos de Bolivia: ${report.terapeuta_registro || 'CPB Acreditado'}`,
            size: 15,
            color: '64748B',
            italics: true
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `${instNombre} · ${instDireccion}`,
            size: 14,
            color: '94A3B8'
          })
        ],
        spacing: { after: 100 }
      })
    );

    // 1. Tabla de datos demográficos y contexto clínico
    const demoRows = [
      new TableRow({
        children: [
          this._createCell('PACIENTE EVALUADO/A:', true, 28, false),
          this._createCell(`${report.paciente_nombres || ''} ${report.paciente_apellidos || ''}`.toUpperCase(), true, 72, false)
        ]
      }),
      new TableRow({
        children: [
          this._createCell('CÓDIGO DE EXPEDIENTE:', true, 28, true),
          this._createCell(`${report.paciente_codigo || 'N/A'} · Cédula de Identidad: ${report.paciente_ci || 'No registrada'}`, false, 72, true)
        ]
      }),
      new TableRow({
        children: [
          this._createCell('EDAD CRONOLÓGICA:', true, 28, false),
          this._createCell(`${ageInfo.formatted} (Fecha de Nacimiento: ${report.paciente_fecha_nacimiento || 'No registrada'})`, false, 72, false)
        ]
      }),
      new TableRow({
        children: [
          this._createCell(isAdult ? 'ACTIVIDAD / OCUPACIÓN:' : 'ESCOLARIDAD / UNIDAD EDUCATIVA:', true, 28, true),
          this._createCell(`${report.paciente_colegio_ocupacion || 'No especificada en el expediente'}`, false, 72, true)
        ]
      })
    ];

    if (!isAdult) {
      demoRows.push(
        new TableRow({
          children: [
            this._createCell('TUTOR O RESPONSABLE LEGAL:', true, 28, false),
            this._createCell(`${report.tutor_nombres ? `${report.tutor_nombres} ${report.tutor_apellidos} (${report.tutor_parentesco || 'Tutor'})` : 'Acreditado/a en secretaría clínica'}`, false, 72, false)
          ]
        })
      );
    } else {
      demoRows.push(
        new TableRow({
          children: [
            this._createCell(isElderly ? 'CUIDADOR / FAMILIAR DE CONTACTO:' : 'REFERENCIA FAMILIAR / CONTACTO:', true, 28, false),
            this._createCell(`${report.tutor_nombres ? `${report.tutor_nombres} ${report.tutor_apellidos} (${report.tutor_parentesco || 'Acompañante'})` : 'Paciente titular con auto-consentimiento legal (Ley 3131)'}`, false, 72, false)
          ]
        })
      );
    }

    demoRows.push(
      new TableRow({
        children: [
          this._createCell('ESPECIALISTA RESPONSABLE:', true, 28, true),
          this._createCell(`Lic. ${report.terapeuta_nombres || ''} ${report.terapeuta_apellidos || ''} (${report.terapeuta_especialidad || 'Neuropsicología'}) · Matrícula CPB: ${report.terapeuta_registro || 'Acreditado/a'}`, false, 72, true)
        ]
      }),
      new TableRow({
        children: [
          this._createCell('FECHA DE EMISIÓN:', true, 28, false),
          this._createCell(`${dateFormatted} · ${instDireccion}`, false, 72, false)
        ]
      })
    );

    const demographicTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: demoRows
    });

    // 2. Tabla de baterías psicométricas y baremos
    let batteriesSection = [];
    const rawBatteries = report.baterias_administradas || report.baterias_aplicadas || [];
    if (Array.isArray(rawBatteries) && rawBatteries.length > 0) {
      const bRows = [
        new TableRow({
          children: [
            this._createHeaderCell('Instrumento / Prueba', 26),
            this._createHeaderCell('Área Neurocognitiva Evaluada', 30),
            this._createHeaderCell('Puntaje Directo / Escalar', 22),
            this._createHeaderCell('Percentil / Clasificación', 22)
          ]
        })
      ];

      rawBatteries.forEach((b, idx) => {
        const isAlt = idx % 2 !== 0;
        const nombrePrueba = b.nombre || b.bateria || b.codigo || 'Batería Evaluativa';
        const areaEval = b.area || b.area_evaluada || 'Funciones Ejecutivas / Cognitivas';
        const puntaje = b.puntuacion || (b.puntuacion_directa ? `PD: ${b.puntuacion_directa} / PE: ${b.puntuacion_escalar || '-'}` : '-');
        const rango = b.interpretacion_clinica || b.interpretacion || (b.rango_percentil ? `Pc ${b.rango_percentil}` : 'Promedio');

        bRows.push(
          new TableRow({
            children: [
              this._createCell(nombrePrueba, true, 26, isAlt),
              this._createCell(areaEval, false, 30, isAlt),
              this._createCell(String(puntaje), false, 22, isAlt, AlignmentType.CENTER),
              this._createCell(String(rango), false, 22, isAlt, AlignmentType.CENTER)
            ]
          })
        );
      });

      batteriesSection = [
        this._createSectionHeading('2', 'Baterías e Instrumentos de Evaluación Aplicados'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: bRows
        })
      ];
    } else {
      batteriesSection = [
        this._createSectionHeading('2', 'Baterías e Instrumentos de Evaluación Aplicados'),
        new Paragraph({
          text: 'Evaluación cualitativa y semiológica integral mediante observación clínica directa, anamnesis psicobiológica y registros de sesión.',
          spacing: { after: 140 }
        })
      ];
    }

    // 3. Pautas y Recomendaciones según grupo etario
    let recomParaA = 'A. Para la Unidad Educativa y Docentes (Adaptaciones Curriculares):';
    let recomParaB = 'B. Para la Familia y el Hogar (Pautas de Estimulación):';
    if (isElderly) {
      recomParaA = 'A. Pautas para el Cuidador Principal y el Entorno Familiar:';
      recomParaB = 'B. Estimulación Neurocognitiva y Actividades de la Vida Diaria (AVD):';
    } else if (isAdult) {
      recomParaA = 'A. Recomendaciones para el Ámbito Laboral / Ocupacional:';
      recomParaB = 'B. Estrategias de Compensación y Estimulación Cognitiva Personal:';
    }

    const isFamilyReport = report.tipo_informe === 'REPORTE_FAMILIAR_AVANCE';
    const reportTitle = isFamilyReport
      ? (report.titulo || 'REPORTE DE AVANCE TERAPÉUTICO Y ORIENTACIÓN FAMILIAR')
      : (report.titulo || 'INFORME CLÍNICO INSTITUCIONAL');

    let bodySections = [];
    if (isFamilyReport) {
      bodySections = [
        this._createSectionHeading('1', 'Objetivos Terapéuticos y Foco de Intervención en Sesión'),
        new Paragraph({
          children: [
            new TextRun({
              text: report.motivo_evaluacion || report.motivo_consulta || 'Durante este ciclo de atención, se han trabajado metas específicas enfocadas en el bienestar integral, la autonomía personal y el desarrollo de habilidades socioemocionales y cognitivas.',
              size: 20,
              color: '334155'
            })
          ],
          spacing: { after: 140 }
        }),

        this._createSectionHeading('2', 'Logros y Avances Observados en el Paciente'),
        new Paragraph({
          children: [
            new TextRun({
              text: report.resultados_cuantitativos || 'Se evidencian avances muy positivos y sostenidos en la disposición al trabajo terapéutico, la autorregulación emocional y la consolidación de nuevas estrategias de afrontamiento adaptativo.',
              size: 20,
              color: '334155'
            })
          ],
          spacing: { after: 140 }
        }),

        this._createSectionHeading('3', 'Aspectos en Proceso de Fortalecimiento y Seguimiento'),
        new Paragraph({
          children: [
            new TextRun({
              text: report.conclusiones_cualitativas || 'Continuamos acompañando y reforzando la perseverancia ante tareas desafiantes, la confianza en las propias capacidades y la generalización de estas habilidades en sus entornos cotidianos.',
              size: 20,
              color: '334155'
            })
          ],
          spacing: { after: 140 }
        }),

        this._createSectionHeading('4', 'Pautas y Recomendaciones Prácticas para el Hogar'),
        new Paragraph({
          children: [
            new TextRun({
              text: report.recomendaciones_familia || '• Fortalecer el refuerzo positivo y celebrar los esfuerzos cotidianos, no únicamente el resultado final.\n• Mantener rutinas visuales claras y predecibles en los horarios de descanso y alimentación.\n• Habilitar espacios de escucha activa libre de juicios para compartir inquietudes y emociones.',
              size: 20,
              color: '334155'
            })
          ],
          spacing: { after: 140 }
        }),

        this._createSectionHeading('5', 'Próximos Pasos y Continuidad del Acompañamiento'),
        new Paragraph({
          children: [
            new TextRun({
              text: report.recomendaciones_colegio || 'Se sugiere mantener la frecuencia de las sesiones programadas y continuar con el trabajo conjunto y comunicación fluida entre la familia y el centro.',
              size: 20,
              color: '334155'
            })
          ],
          spacing: { after: 260 }
        })
      ];
    } else {
      bodySections = [
        this._createSectionHeading('1', 'Motivo de Consulta y Antecedentes Relevantes'),
        new Paragraph({
          children: [
            new TextRun({
              text: report.motivo_evaluacion || report.motivo_consulta || 'El/la paciente acude al centro para valoración diagnóstica y seguimiento psicoterapéutico especializado.',
              size: 20,
              color: '334155'
            })
          ],
          spacing: { after: 120 }
        }),
        ...(report.antecedentes_relevantes ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'Antecedentes Clínicos y del Neurodesarrollo: ', bold: true, size: 20, color: '27345F' }),
              new TextRun({ text: report.antecedentes_relevantes, size: 20, color: '334155' })
            ],
            spacing: { after: 140 }
          })
        ] : []),
        ...batteriesSection,
        this._createSectionHeading('3', 'Resultados Cuantitativos y Análisis Cualitativo por Dominios'),
        new Paragraph({
          children: [
            new TextRun({
              text: report.resultados_cuantitativos || report.interpretacion_resultados || 'El perfil psicométrico global se sitúa en los parámetros de referencia esperados, con áreas específicas de estimulación.',
              size: 20,
              color: '334155'
            })
          ],
          spacing: { after: 120 }
        }),
        ...(report.conclusiones_cualitativas ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'Observaciones Cualitativas y Comportamiento Clínico: ', bold: true, size: 20, color: '27345F' }),
              new TextRun({ text: report.conclusiones_cualitativas, size: 20, color: '334155' })
            ],
            spacing: { after: 140 }
          })
        ] : []),
        this._createSectionHeading('4', 'Conclusiones Diagnósticas e Impresión Clínica (CIE-11 / DSM-5)'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: 'F8F9FD' },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
                    bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
                    left: { style: BorderStyle.SINGLE, size: 10, color: '584294' },
                    right: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'DIAGNÓSTICO PRINCIPAL: ', bold: true, size: 20, color: '27345F' }),
                        new TextRun({
                          text: `${report.diagnostico_codigo ? `[${report.diagnostico_codigo}] ` : ''}${report.diagnostico_descripcion || report.conclusiones_diagnosticas || 'Evaluación neurocognitiva y de funciones del neurodesarrollo.'}`,
                          bold: true,
                          size: 20,
                          color: '584294'
                        })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }),
        this._createSectionHeading('5', 'Recomendaciones y Pautas de Intervención'),
        new Paragraph({
          children: [
            new TextRun({ text: `${recomParaA}\n`, bold: true, size: 20, color: '27345F' }),
            new TextRun({
              text: report.recomendaciones_colegio || report.plan_recomendaciones || '• Adecuaciones metodológicas de tiempo y presentación de consignas.\n• Refuerzo positivo y estructuración de actividades paso a paso.',
              size: 20,
              color: '334155'
            })
          ],
          spacing: { after: 140 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `${recomParaB}\n`, bold: true, size: 20, color: '27345F' }),
            new TextRun({
              text: report.recomendaciones_familia || '• Fomentar hábitos de autonomía, organización y rutinas estables.\n• Coordinación fluida y periódica con los especialistas tratantes del centro.',
              size: 20,
              color: '334155'
            })
          ],
          spacing: { after: 260 }
        })
      ];
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1100,
                bottom: 1100,
                left: 1200,
                right: 1200
              }
            }
          },
          children: [
            // Membrete Superior Institucional de Alta Gama
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 60, type: WidthType.PERCENTAGE },
                      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: instNombre.toUpperCase(),
                              bold: true,
                              size: 21,
                              color: '27345F'
                            })
                          ]
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: 'Especialidades: Neuropsicología Infantil · Psicopedagogía · Valoración Gerontológica · Psicología Clínica',
                              size: 16,
                              color: '584294',
                              italics: true
                            })
                          ]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 40, type: WidthType.PERCENTAGE },
                      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: `Dirección General: ${instDirectora}`,
                              bold: true,
                              size: 16,
                              color: '27345F'
                            })
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: `${instDireccion}\nTelf. ${instTelefono} · www.psi-aprende.com`,
                              size: 15,
                              color: '64748B'
                            })
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),

            // Línea divisoria elegante en púrpura institucional
            new Paragraph({
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 12, color: '584294', space: 6 }
              },
              spacing: { after: 200 }
            }),

            // Título del Documento en Banner Shaded
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      shading: { fill: 'F1ECFA' },
                      margins: { top: 120, bottom: 120, left: 140, right: 140 },
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 4, color: '584294' },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: '584294' },
                        left: { style: BorderStyle.SINGLE, size: 16, color: '27345F' },
                        right: { style: BorderStyle.SINGLE, size: 4, color: '584294' }
                      },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: reportTitle.toUpperCase(),
                              bold: true,
                              size: 24,
                              color: '27345F'
                            })
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ spacing: { after: 160 } }),

            // Ficha Demográfica del Paciente
            demographicTable,

            // Secciones del Cuerpo (Adaptables: Familiar vs Técnico Clínico)
            ...bodySections,

            // Bloque de Firma Profesional Oficial del Especialista Evaluador (Ley N° 3131 y CPB)
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'RESPONSABILIDAD PROFESIONAL Y FIRMA DEL ESPECIALISTA EVALUADOR',
                  bold: true,
                  size: 14,
                  color: '64748B'
                })
              ],
              spacing: { before: 240, after: 80 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                      children: [new Paragraph({})]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                      children: signatureCellChildren
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                      children: [new Paragraph({})]
                    })
                  ]
                })
              ]
            })
          ]
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = `informe_${report.paciente_codigo || 'EXP'}_${report.id}.docx`;
    const filePath = path.join(REPORTS_DIR, fileName);

    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  _parseAge(birthDateStr) {
    if (!birthDateStr) return { years: 0, months: 0, formatted: 'No especificada' };
    const birth = new Date(birthDateStr);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
      years--;
      months += 12;
    }
    return {
      years,
      months,
      formatted: `${years} años y ${months} meses`
    };
  }

  _createSectionHeading(numberStr, titleText) {
    return new Paragraph({
      shading: { fill: 'F1ECFA' },
      spacing: { before: 140, after: 60 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 14, color: '584294', space: 6 }
      },
      children: [
        new TextRun({
          text: ` ${numberStr}. ${titleText.toUpperCase()}`,
          bold: true,
          size: 21,
          color: '27345F'
        })
      ]
    });
  }

  _createHeaderCell(text, widthPct = 25) {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: { fill: '27345F' },
      margins: { top: 120, bottom: 120, left: 100, right: 100 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '27345F' },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: '584294' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '3A4A7A' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '3A4A7A' }
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text || '',
              bold: true,
              size: 19,
              color: 'FFFFFF'
            })
          ],
          alignment: AlignmentType.CENTER
        })
      ]
    });
  }

  _createCell(text, isBold = false, widthPct = 50, isAlternate = false, align = AlignmentType.LEFT) {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: isAlternate ? { fill: 'F8F9FD' } : undefined,
      margins: { top: 90, bottom: 90, left: 110, right: 110 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
        left: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
        right: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' }
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text || '',
              bold: isBold,
              size: 18,
              color: isBold ? '27345F' : '334155'
            })
          ],
          alignment: align
        })
      ]
    });
  }
}
