import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';

export class TriageService {
  constructor() {
    this.triageRepo = RepositoryFactory.getTriageRepository();
    this.configRepo = RepositoryFactory.getConfigRepository();
    this.userRepo = RepositoryFactory.getUserRepository();
  }

  /**
   * Patrones deterministas de crisis aguda, ideación suicida o emergencia médica/psicológica.
   * Regla de Negocio: Salta de inmediato sin pasar por el LLM.
   */
  static CRISIS_PATTERNS = [
    /\bsuicidi(o|arse|arme|arte|arnos)\b/i,
    /\bquitarme la vida\b/i,
    /\bmatarme\b/i,
    /\bacabar con mi vida\b/i,
    /\bno quiero vivir\b/i,
    /\bdeseo morir\b/i,
    /\bquiero morir\b/i,
    /\bquiero morirme\b/i,
    /\bhacerme da[ñn]o\b/i,
    /\bcortarme las venas\b/i,
    /\bcortes en las mu[ñn]ecas\b/i,
    /\bahorcarme\b/i,
    /\btomarme todas las pastillas\b/i,
    /\bsobredosis para morir\b/i,
    /\bviolencia f[íi]sica grave\b/i,
    /\babuso sexual\b/i,
    /\bmaltrato severo\b/i,
    /\bgolpear de gravedad\b/i
  ];

  /**
   * Líneas oficiales de contención psicológica y emergencia en Cochabamba y Bolivia.
   */
  static CRISIS_HELP_LINES = [
    {
      nombre: 'Teléfono de la Esperanza Cochabamba (Atención en Crisis y Prevención del Suicidio)',
      numero: '(+591) 4 4252323',
      horario: '24 horas / Atención continua confidencial',
      tipo: 'LINEA_CRISIS'
    },
    {
      nombre: 'Defensoría de la Niñez y Adolescencia (Cochabamba - Protección al Menor)',
      numero: '156 / (+591) 4 4255319',
      horario: 'Línea gratuita 24/7',
      tipo: 'PROTECCION_INFANTIL'
    },
    {
      nombre: 'Cruz Roja Boliviana - Filial Cochabamba (Emergencias Médicas y Rescate)',
      numero: '(+591) 4 4220042',
      horario: 'Emergencias 24 horas',
      tipo: 'MEDICA_URGENTE'
    },
    {
      nombre: 'Radio Patrulla 110 (Policía Boliviana - Emergencias Inmediatas)',
      numero: '110',
      horario: '24 horas',
      tipo: 'SEGURIDAD_PUBLICA'
    },
    {
      nombre: 'Centro Psicopedagógico PSI Aprende (Orientación y Derivación Urgente)',
      numero: '+591 71234567',
      horario: 'Lunes a Sábado (Atención ambulatoria)',
      tipo: 'INSTITUCIONAL'
    }
  ];

  /**
   * Anonimiza datos biomédicos y de filiación antes de enviarlos a servicios externos.
   * Cumplimiento estricto de la Regla 5 de recuerda.md y secreto profesional.
   */
  sanitizeMessage(text) {
    if (!text || typeof text !== 'string') return '';

    let sanitized = text;

    // 1. Direcciones de correo electrónico
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[CORREO ANONIMIZADO]');

    // 2. Números telefónicos bolivianos (+591, 7xxxxxxx, 6xxxxxxx, fijos 4xxxxxx)
    sanitized = sanitized.replace(/(\+?591\s*[-.]?)?([67]\d{7}\b|4\d{6}\b)/g, '[TELÉFONO ANONIMIZADO]');

    // 3. Cédulas de Identidad bolivianas (ej: 1234567 LP, 9876543 CB, o numéricas de 5 a 8 dígitos)
    sanitized = sanitized.replace(/\b\d{5,8}(\s*(LP|CB|SC|OR|PT|TJ|CH|BE|PD|lp|cb|sc|or|pt|tj|ch|be|pd))?\b/g, '[C.I. ANONIMIZADO]');

    // 4. Menciones explícitas de nombres familiares ("mi hijo/a [Nombre]", "paciente [Nombre]")
    sanitized = sanitized.replace(/(mi hijo|mi hija|mi ni[ñn]o|mi ni[ñn]a|mi esposo|mi esposa|mi abuelo|mi abuela|paciente|llamado|llamada)\s+([A-ZÁÉÍÓÚ][a-záéíóú]+(\s+[A-ZÁÉÍÓÚ][a-záéíóú]+)?)/gi, '$1 [NOMBRE ANONIMIZADO]');

    return sanitized;
  }

  /**
   * Evalúa si el mensaje contiene patrones deterministas de crisis.
   */
  isCrisisContent(text) {
    if (!text) return false;
    return TriageService.CRISIS_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Determina si el texto trata sobre temas del centro, psicología, conducta,
   * psicopedagogía, especialistas, citas, consultorios o servicios de PSI Aprende.
   */
  static isClinicOrCenterRelated(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const terms = [
      // Centro institucional y plataforma
      'psi aprende', 'psi-aprende', 'psi', 'aprende', 'centro', 'clinica', 'consultorio', 'sala', 'ambiente',
      'edificio guiller', 'piso 7', 'horario', 'atencion', 'direccion', 'ubicacion', 'telefono', 'whatsapp',
      'contacto', 'arancel', 'precio', 'costo', 'tarifa', 'pago', 'simple qr', 'qr', 'recepcion', 'secretar',
      'portal', 'dashboard', 'plataforma', 'perfil', 'pagina', 'sistema',
      // Especialistas
      'grisel', 'morales', 'mendez', 'bustamante', 'torrico', 'terapeuta', 'especialista', 'psicolog',
      'fonoaudiolog', 'psicopedagog', 'neurolog', 'neuropediatr', 'doctor', 'licenciad', 'colegio de psicologos', 'cpb',
      // Áreas clínicas y diagnóstico
      'psicologia', 'psicopedagogia', 'neuropsicologia', 'psicogerontologia', 'fonoaudiologia', 'terapia',
      'psicoterapia', 'estimulacion', 'rehabilitacion', 'evaluacion', 'diagnostico', 'test', 'bateria',
      'wisc', 'cumanes', 'tamizaje', 'anamnesis', 'historia clinica', 'expediente', 'plan terapeutico', 'pti',
      'meta smart', 'pauta',
      // Paciente, familia y manifestaciones
      'hijo', 'hija', 'nino', 'nina', 'bebe', 'adolescente', 'joven', 'adulto', 'abuelo', 'abuela',
      'papa', 'mama', 'padre', 'madre', 'familiar', 'tutor', 'familia', 'colegio', 'escuela', 'profesor',
      'maestr', 'tarea', 'rendimiento', 'conducta', 'comportamiento', 'disciplina', 'berrinche', 'rabieta',
      'agresiv', 'desobedi', 'limite', 'desafio', 'atencion', 'concentra', 'tdah', 'hiperactiv', 'impulsiv',
      'inatenc', 'distra', 'olvido', 'memoria', 'alzheimer', 'demencia', 'deterioro cognitivo', 'autism',
      'tea', 'asperger', 'ansiedad', 'miedo', 'panico', 'fobia', 'triste', 'depresi', 'llanto', 'duelo',
      'separacion', 'autoestima', 'emocion', 'estres', 'sueno', 'insomnio', 'pesadilla', 'alimentacion',
      'lenguaje', 'habla', 'pronunci', 'tartamud', 'vocaliz', 'dislali', 'disfasia', 'tdl', 'lectura',
      'leer', 'escritura', 'escribir', 'dislexia', 'disgrafia', 'discalculia', 'cita', 'turno', 'agendar', 'sesion'
    ];

    return terms.some(t => lower.includes(t));
  }

  /**
   * Determina si un mensaje es saludo, cortesía o confirmación breve (no off-topic).
   */
  static isCourtesyOrGreeting(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (lower.length > 50) return false;
    return /^(hola|buen(os)?\s*(dias|tardes|noches)|buenas|que tal|como estas|como te va|saludos|gracias|muchas gracias|ok|de acuerdo|entendido|adios|hasta luego|chao|si|no)\b/i.test(lower);
  }

  /**
   * Determina si una consulta es explícitamente fuera de tema (off-topic).
   */
  static isExplicitOffTopic(text) {
    if (!text || typeof text !== 'string') return false;
    if (TriageService.isClinicOrCenterRelated(text)) return false;
    if (TriageService.isCourtesyOrGreeting(text)) return false;

    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const offTopicPatterns = [
      /\breceta\b/i, /\bcocinar\b/i, /\bingredientes\b/i, /\btorta\b/i, /\bpizza\b/i, /\blasagna\b/i, /\bcomida\b/i,
      /\bchiste\b/i, /\bcuentame un chiste\b/i, /\bpoema\b/i, /\bpoesia\b/i, /\brima\b/i, /\bcancion\b/i,
      /\bfutbol\b/i, /\bpartido\b/i, /\bmundial\b/i, /\bequipo\b/i, /\bliga\b/i, /\bgol\b/i, /\bcampeon\b/i,
      /\bcapital de\b/i, /\bcuanto mide\b/i, /\bmonte everest\b/i, /\bquien descubrio\b/i, /\bclima\b/i, /\btemperatura\b/i,
      /\bcuanto es \d+/i, /\bcalcular \d+/i, /\braiz cuadrada\b/i, /\bequacion\b/i, /\bcalcula\b/i,
      /\bquien es el presidente\b/i, /\belecciones\b/i, /\bpolitica\b/i, /\bpelicula\b/i, /\bserie\b/i, /\bnetflix\b/i,
      /\bvideojuego\b/i, /\bplaystation\b/i, /\bxbox\b/i, /\bminecraft\b/i, /\broblox\b/i, /\bfortnite\b/i,
      /\bastronauta\b/i, /\bviaje espacial\b/i, /\bauto\b/i, /\bmotor\b/i
    ];

    if (offTopicPatterns.some(p => p.test(lower))) return true;

    if (/^(que es|quien es|donde queda|cuando fue|como se hace|por que)\b/i.test(lower)) {
      return true;
    }

    return false;
  }

  /**
   * Procesa la consulta de triaje mediante:
   * 1. Filtro determinista de crisis.
   * 2. Anonimización biomédica.
   * 3. LLM GroqCloud (openai/gpt-oss-120b / openai/gpt-oss-20b).
   * 4. Fallback Heurístico Local Offline en caso de fallo de red o clave demo.
   */
  async processTriage({ message, sessionId = null, userId = null, userRole = 'TUTOR', userName = 'Usuario', ip = null, conversationHistory = [], priorOffTopicCount: explicitPriorOffTopicCount = null }) {
    if (!message || message.trim().length === 0) {
      throw AppError.badRequest('El mensaje para el Asistente MindBot no puede estar vacío.');
    }

    const rawMessage = message.trim();

    // =========================================================================
    // PASO 1: SALVAGUARDA DETERMINISTA DE CRISIS (HARD RULE)
    // =========================================================================
    if (this.isCrisisContent(rawMessage)) {
      const crisisResult = {
        tipo_consulta: 'CRISIS_EMERGENCIA',
        es_crisis: true,
        es_triaje: false,
        respuesta_conversacional: 'Hemos detectado que estás pasando por un momento de profundo sufrimiento o riesgo vital. Tu vida, tu seguridad y tu bienestar son lo más valioso. Por favor, comunícate de inmediato con las líneas de auxilio psicológico y emergencia oficiales de Cochabamba que te comparto aquí abajo.',
        area_sugerida: 'Emergencia Psicológica / Hospitalaria Inmediata',
        nivel_urgencia: 'Emergencia Inmediata',
        motivo_sintetizado: 'Se ha detectado una situación de riesgo vital, sufrimiento emocional extremo o ideación crítica.',
        recomendacion_accion: 'Comunícate ahora mismo con las líneas de contención o acude al centro médico más cercano acompañado de alguien de confianza.',
        preguntas_orientadoras: [
          '¿Estás acompañado(a) en este momento por alguien de confianza?',
          '¿Puedes comunicarte ahora mismo con el Teléfono de la Esperanza al 4 4252323?',
          '¿Deseas que activemos la derivación prioritaria hacia la Dirección Médica del centro?'
        ],
        lineas_auxilio: TriageService.CRISIS_HELP_LINES,
        enlace_sugerido: null,
        requiere_aviso_profesional: false,
        reorientacion_institucional: null,
        motor_utilizado: 'FILTRO_CRISIS'
      };

      // Registrar en base de datos para trazabilidad ética y de seguridad
      try {
        await this.triageRepo.create({
          sesionId: sessionId,
          usuarioId: userId,
          motivoConsulta: rawMessage,
          motivoAnonimizado: this.sanitizeMessage(rawMessage),
          areaSugerida: crisisResult.area_sugerida,
          nivelUrgencia: crisisResult.nivel_urgencia,
          motivoSintetizado: crisisResult.motivo_sintetizado,
          preguntasOrientadoras: crisisResult.preguntas_orientadoras,
          recomendacionAccion: crisisResult.recomendacion_accion,
          esCrisis: true,
          motorUtilizado: 'FILTRO_CRISIS',
          ipOrigen: ip
        });

        await this.userRepo.logAudit(userId, 'TRIAGE_CRISIS_DETECTED', 'MINDBOT_IA', 'Filtro determinista de crisis activado. Líneas de emergencia desplegadas.', ip);
      } catch (logErr) {
        console.error('[TriageService] Error al auditar evento de crisis:', logErr.message);
      }

      return crisisResult;
    }

    // =========================================================================
    // PASO 2: ANONIMIZACIÓN BIOMÉDICA DEL PROMPT Y ANÁLISIS DE ESTADO
    // =========================================================================
    const sanitizedPrompt = this.sanitizeMessage(rawMessage);

    // Ventana deslizante para optimización de tokens y prevención de 429 TPM
    const slidingHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-8) : [];

    // Conteo de consultas previas fuera de tema (off-topic) en la sesión del tutor
    const priorOffTopicCount = Number.isInteger(explicitPriorOffTopicCount)
      ? explicitPriorOffTopicCount
      : (Array.isArray(conversationHistory)
        ? conversationHistory.filter(item => {
            if (item.sender === 'bot') {
              const d = item.data;
              return d && (
                d.es_offtopic === true ||
                d.tipo_consulta === 'LIMITE_OFFTOPIC_ALCANZADO'
              );
            }
            return false;
          }).length
        : 0);

    // Detectar si en la conversación ya existe un triaje previo activo emitido
    const hasPriorTriageInHistory = slidingHistory.some(item => {
      if (item.sender === 'bot') {
        return item.data?.es_triaje === true || (item.data?.area_sugerida && item.data?.nivel_urgencia);
      }
      return false;
    });

    // =========================================================================
    // PASO 3: INTENTO DE INFERENCIA EN LA NUBE CON GROQCLOUD
    // =========================================================================
    let triageResult = null;
    let motorUsado = null;

    try {
      const apiKey = await this.configRepo.getByKey('GROQ_API_KEY');
      const isDemoKey = !apiKey || apiKey.startsWith('gsk_demo_') || apiKey.length < 20;

      if (!isDemoKey) {
        // Intento 1: Modelo Primario de alta capacidad
        const primaryModel = (await this.configRepo.getByKey('GROQ_MODEL_PRIMARY')) || 'openai/gpt-oss-120b';
        triageResult = await this._callGroqWithTimeout(apiKey, primaryModel, sanitizedPrompt, slidingHistory, userRole, userName, hasPriorTriageInHistory, priorOffTopicCount, 10000);
        motorUsado = 'GROQ_CLOUD';
      }
    } catch (primaryErr) {
      console.warn(`[TriageService] Falló modelo primario GroqCloud (${primaryErr.message}). Intentando fallback cloud...`);
      try {
        const apiKey = await this.configRepo.getByKey('GROQ_API_KEY');
        const fallbackModel = (await this.configRepo.getByKey('GROQ_MODEL_FALLBACK')) || 'openai/gpt-oss-20b';
        triageResult = await this._callGroqWithTimeout(apiKey, fallbackModel, sanitizedPrompt, slidingHistory, userRole, userName, hasPriorTriageInHistory, priorOffTopicCount, 10000);
        motorUsado = 'GROQ_CLOUD_FALLBACK';
      } catch (secErr) {
        console.warn(`[TriageService] Falló modelo secundario GroqCloud (${secErr.message}). Conmutando a Fallback Heurístico Offline...`);
      }
    }

    // =========================================================================
    // PASO 4: FALLBACK HEURÍSTICO LOCAL OFFLINE (RESILIENCIA TOTAL)
    // =========================================================================
    if (!triageResult) {
      triageResult = await this._runLocalHeuristicEngine(sanitizedPrompt, userRole, userName, hasPriorTriageInHistory, priorOffTopicCount);
      motorUsado = 'FALLBACK_HEURISTICO_OFFLINE';
    }

    // =========================================================================
    // SALVAGUARDA ÉTICA Y DE LÍMITES PARA ROL TUTOR
    // =========================================================================
    const isClinicTopic = TriageService.isClinicOrCenterRelated(rawMessage);
    const isCourtesy = TriageService.isCourtesyOrGreeting(rawMessage);
    const isOffTopicQuery = !isClinicTopic && !isCourtesy && (
      TriageService.isExplicitOffTopic(rawMessage) ||
      triageResult.tipo_consulta === 'LIMITE_OFFTOPIC_ALCANZADO'
    );

    triageResult.es_offtopic = !!isOffTopicQuery;

    if (userRole === 'TUTOR') {
      if (isClinicTopic) {
        // Si el usuario pregunta de psicología, conducta, el centro, terapeutas, citas, etc.,
        // NUNCA debe bloquearse, incluso si previamente alcanzó el límite con preguntas off-topic.
        if (triageResult.tipo_consulta === 'LIMITE_OFFTOPIC_ALCANZADO') {
          triageResult.tipo_consulta = 'CONVERSACION_GENERAL';
          triageResult.reorientacion_institucional = null;
        }
        triageResult.es_offtopic = false;
      } else if (isOffTopicQuery) {
        // La consulta actual es genuinamente ajena al centro (recetas, fútbol, chistes...)
        if (priorOffTopicCount >= 2) {
          triageResult.tipo_consulta = 'LIMITE_OFFTOPIC_ALCANZADO';
          triageResult.es_triaje = false;
          triageResult.requiere_aviso_profesional = false;
          triageResult.reorientacion_institucional = 'Has alcanzado el límite de 3 preguntas fuera del ámbito del centro para usuarios tutores.';
          triageResult.respuesta_conversacional = 'Estimado(a) tutor(a): Como asistente virtual oficial del Centro Psicopedagógico y Psicológico "PSI Aprende", mi propósito es orientarte exclusivamente en temas de psicología, psicopedagogía, neurodesarrollo y los servicios de nuestra institución. Para consultas de cultura general, tareas de otras materias o temas diversos, existen otras inteligencias artificiales de uso general (como ChatGPT o Gemini). Con el fin de preservar y optimizar los recursos del centro para la atención de las familias, te solicitamos enfocar tus consultas en el bienestar y la atención de tu familia en PSI Aprende.';
          triageResult.area_sugerida = null;
          triageResult.nivel_urgencia = null;
          triageResult.motivo_sintetizado = 'Límite de 3 consultas fuera de tema alcanzado para el rol tutor.';
          triageResult.preguntas_orientadoras = [];
          triageResult.recomendacion_accion = 'Por favor realiza consultas vinculadas a la salud mental, dificultades de aprendizaje o servicios del centro.';
          triageResult.enlaces_rapidos = [
            { label: 'Ver Especialistas del Centro', url: '#/portal/therapists' },
            { label: 'Ir a Mi Portal Familiar', url: '#/dashboard' }
          ];
        } else {
          triageResult.reorientacion_institucional = 'Recordatorio institucional: Como asistente de PSI Aprende, mi especialidad es el bienestar psicológico, psicopedagógico y la atención de tu familia en nuestro centro.';
        }
      }
    }

    triageResult.motor_utilizado = motorUsado;
    triageResult.es_crisis = false;

    // Normalizar campos obligatorios para el frontend
    if (!triageResult.respuesta_conversacional) {
      triageResult.respuesta_conversacional = triageResult.motivo_sintetizado || triageResult.recomendacion_accion || '¿En qué puedo orientarte hoy?';
    }

    // Si ya hubo triaje previo, asegurarse de que no se repita la tarjeta visual
    if (hasPriorTriageInHistory && triageResult.es_triaje) {
      triageResult.es_triaje = false;
    }

    // =========================================================================
    // PASO 5: PERSISTENCIA Y AUDITORÍA EN SQLITE
    // =========================================================================
    try {
      await this.triageRepo.create({
        sesionId: sessionId,
        usuarioId: userId,
        motivoConsulta: rawMessage,
        motivoAnonimizado: sanitizedPrompt,
        areaSugerida: triageResult.area_sugerida || 'Orientación Institucional',
        nivelUrgencia: triageResult.nivel_urgencia || 'Baja',
        motivoSintetizado: triageResult.motivo_sintetizado || triageResult.respuesta_conversacional?.substring(0, 200),
        preguntasOrientadoras: triageResult.preguntas_orientadoras || [],
        recomendacionAccion: triageResult.recomendacion_accion || null,
        esCrisis: false,
        motorUtilizado: motorUsado,
        ipOrigen: ip
      });

      await this.userRepo.logAudit(userId, 'TRIAGE_QUERY', 'MINDBOT_IA', `Consulta procesada con éxito mediante ${motorUsado} (Rol: ${userRole})`, ip);
    } catch (saveErr) {
      console.warn('[TriageService] Advertencia al persistir triaje:', saveErr.message);
    }

    return triageResult;
  }

  /**
   * Llamada a GroqCloud con AbortController, gobernanza RBAC y generación conversacional estructurada.
   */
  async _callGroqWithTimeout(apiKey, model, userMessage, conversationHistory, userRole = 'TUTOR', userName = 'Usuario', hasPriorTriageInHistory = false, priorOffTopicCount = 0, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const instAddress = (this.configRepo ? await this.configRepo.getByKey('INSTITUCION_DIRECCION') : null) || 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba';
    const instHorario = (this.configRepo ? await this.configRepo.getByKey('INSTITUCION_HORARIO') : null) || 'L-V 08:30-12:30 y 14:30-18:30, Sáb 09:00-13:00';
    const instDirectora = (this.configRepo ? await this.configRepo.getByKey('INSTITUCION_DIRECTORA') : null) || 'Mgr. Grisel Aguilar';
    const instNombre = (this.configRepo ? await this.configRepo.getByKey('INSTITUCION_NOMBRE') : null) || 'PSI Aprende';

    const systemPrompt = `
Eres MindBot IA, el asistente virtual inteligente, empático y orientador oficial del Centro Psicopedagógico y de Atención Psicológica "${instNombre}" en Cochabamba, Bolivia (Dirección General: ${instDirectora}).

CONTEXTO DEL USUARIO AUTENTICADO:
- Nombre: ${userName || 'Usuario'}
- Rol en la plataforma: ${userRole || 'TUTOR'} (Valores posibles: ADMIN, TERAPEUTA, RECEPCION, TUTOR)
- Conteo previo de preguntas ajenas / off-topic en esta sesión: ${priorOffTopicCount}

GOBERNANZA DE DATOS Y CONTROL DE ACCESO BASADO EN ROLES (RBAC ESTRICTO):
Debes adaptar tus respuestas y permisos de información estrictamente al rol del usuario:
1. ROL ADMIN:
   - Acceso total. Puede preguntar y recibir instrucciones directas sobre: administración de usuarios, asignación y cambio de roles, eliminación o archivado de cuentas ([Gestión de Usuarios](#/admin/users)), configuración de salas físicas ([Consultorios y Salas](#/admin/rooms)), auditoría del sistema, métricas y reportes globales.
2. ROL TERAPEUTA:
   - Personal clínico acreditado. Puede consultar sobre: expedientes clínicos, notas de evolución SOAP, anamnesis, pacientes asignados ([Gestión de Pacientes](#/patients)), agenda de salas ([Consultorios y Salas](#/admin/rooms) en modo consulta), directorio de especialistas ([Especialistas](#/therapists)), psicometría y criterios diagnósticos orientativos.
   - RESTRICCIÓN DE SEGURIDAD: Si un terapeuta pregunta cómo eliminar usuarios, cambiar roles o administrar cuentas del personal, debes responderle con respeto que dichas facultades administrativas son competencia exclusiva de la Dirección General / Administrador.
3. ROL RECEPCION:
   - Personal administrativo de atención. Puede consultar sobre: admisión y registro de pacientes, gestión de turnos, verificación de disponibilidad de consultorios ([Consultorios y Salas](#/admin/rooms)), lista de especialistas ([Especialistas](#/therapists)) y cobros con Simple QR.
   - RESTRICCIÓN DE SEGURIDAD: No tiene acceso a expedientes clínicos confidenciales de diagnóstico ni a eliminación de usuarios.
4. ROL TUTOR:
   - Padre de familia, tutor legal o paciente.
   - Puede consultar sobre: orientación de triaje para su hijo o familiar, citas agendadas, horarios del centro, aranceles oficiales, consultorios físicos ([Especialistas](#/therapists), [Mi Perfil](#/profile)) y temas psicoeducativos (ansiedad, TDAH, problemas de aprendizaje, etc.).
   - REGLA CRÍTICA DE SEGURIDAD Y PRIVACIDAD (CONFIDENCIALIDAD MÉDICA): Si un Tutor pregunta sobre funciones internas o administrativas (ej. "¿Dónde puedo eliminar usuarios?", "¿Dónde veo las historias clínicas de todos los pacientes?", "¿Cómo cambio mi rol?", "¿Cómo accedo a los datos de otros?"), DEBES NEGARLE LA INFORMACIÓN de manera cordial, clara y formal:
     "Como tutor o familiar, no tienes acceso a las funciones administrativas del sistema ni a expedientes de otros pacientes por normativas de seguridad institucional, secreto profesional y confidencialidad médica (Ley 3131). Si necesitas realizar algún trámite administrativo o consultar sobre tu cuenta, por favor comunícate directamente con Recepción o la Dirección General."
   - REGLA ESTRICTA DE 3 CONSULTAS OFF-TOPIC PARA USUARIOS CON ROL TUTOR:
     Si el usuario tiene ROL TUTOR y realiza una consulta ajena a la psicología, psicopedagogía, salud mental, neurodesarrollo o servicios del centro (ej. tareas escolares de otras materias, deportes, recetas de cocina, chistes, poesía, etc.):
     - Si el conteo previo es 0 o 1 (es su 1ra o 2da pregunta off-topic): Responde cordialmente y añade la nota en 'reorientacion_institucional'.
     - Si el conteo previo es >= 2 (es su 3ra o posterior pregunta off-topic): ¡NO DEBES RESPONDER A LA PREGUNTA AJENA! Asigna "tipo_consulta": "LIMITE_OFFTOPIC_ALCANZADO", y emite en "respuesta_conversacional" el mensaje:
       "Estimado(a) tutor(a): Como asistente virtual oficial del Centro Psicopedagógico y Psicológico 'PSI Aprende', mi propósito es orientarte exclusivamente en temas de psicología, psicopedagogía, neurodesarrollo y los servicios de nuestra institución. Para consultas de cultura general, tareas escolares de otras materias o temas diversos, existen otras inteligencias artificiales de uso general (como ChatGPT o Gemini). Con el fin de preservar y optimizar los recursos del centro para la atención de las familias, te solicitamos enfocar tus consultas en el bienestar y la atención de tu familia en PSI Aprende."
     - ATENCIÓN CRÍTICA: Si el usuario pregunta o vuelve a preguntar sobre temas del centro, psicología, psicopedagogía, dificultades de su hijo/familiar, conducta, especialistas, horarios o citas, ¡NUNCA LO BLOQUEES! Responde a su consulta con toda la orientación correspondiente ("tipo_consulta": "TRIAJE_CASO" o "GUIA_PLATAFORMA" o "PSICOEDUCACION_CLINICA"). El límite NUNCA se aplica a preguntas sobre el centro o la psicología.
     - ESTA RESTRICCIÓN APLICA EXCLUSIVAMENTE AL ROL TUTOR. Los roles ADMIN, TERAPEUTA y RECEPCION NO tienen este límite.

ESTADO DE TRIAJE EN ESTA CONVERSACIÓN:
${hasPriorTriageInHistory ? `
- ATENCIÓN: En mensajes anteriores de esta sesión YA se emitió una derivación preliminar de triaje con su tarjeta visual.
- AHORA TE ENCUENTRAS EN FASE DE SEGUIMIENTO Y PROFUNDIZACIÓN CLÍNICA.
- Si el usuario continúa detallando la situación (ej. responde a tus preguntas orientadoras, indica cuánto tiempo lleva el problema, etc.):
  - "es_triaje": false (¡CRÍTICO: NO vuelvas a generar la ficha visual de triaje ni repetir preguntas orientadoras; responde en "respuesta_conversacional" con empatía humana, valorando la información compartida!).
  - "requiere_aviso_profesional": false (no satures al usuario con advertencias repetitivas en cada turno).
  - "reorientacion_institucional": null.
` : `
- Si es la PRIMERA VEZ que el usuario describe un síntoma o motivo de consulta propio o de un familiar:
  - "es_triaje": true.
  - Asigna "area_sugerida" entre: "Neuropsicología Infantil", "Psicopedagogía", "Psicogerontología y Adulto Mayor", "Psicología Clínica y Conductual" o "Terapia del Lenguaje y Fonoaudiología".
  - Asigna "nivel_urgencia": "Baja", "Media" o "Alta".
  - Formula 3 "preguntas_orientadoras" empáticas que el terapeuta explorará en sesión.
  - "requiere_aviso_profesional": true.
`}

CONSULTAS SOBRE LA PLATAFORMA O NAVEGACIÓN (ej. "¿Dónde veo a los terapeutas?", "¿Dónde está el personal desvinculado?", "¿Dónde está la bitácora auditora?"):
- "tipo_consulta": "GUIA_PLATAFORMA"
- Explica de forma concisa cómo acceder e incluye enlaces directos en formato Markdown SPA y botones en "enlaces_rapidos".
- CATÁLOGO CANÓNICO DE RUTAS Y DEEP LINKS SEGÚN EL ROL (NUNCA INVENTES OTRAS RUTAS):
  - Si el usuario es ADMIN:
    - Personal Desvinculado / Inactivo: [Personal Desvinculado](#/admin/users/inactive) -> "#/admin/users/inactive" (Activa automáticamente la pestaña de personal desvinculado).
    - Cuentas de Tutores y Familias: [Directorio de Tutores](#/admin/users/tutors) -> "#/admin/users/tutors" (Activa automáticamente la pestaña de tutores).
    - Bitácora de Auditoría y Seguridad: [Bitácora de Auditoría](#/admin/audit) -> "#/admin/audit" (Abre automáticamente el modal inalterable de auditoría).
    - Gestión de Usuarios y Roles: [Gestión de Usuarios](#/admin/users) -> "#/admin/users".
    - Registrar Nuevo Personal/Usuario: [Nuevo Personal](#/admin/users/new) -> "#/admin/users/new" (Abre el modal de registro).
    - Consultorios y Salas Físicas: [Consultorios y Salas](#/admin/rooms) -> "#/admin/rooms".
    - Ajustes del Sistema / Configuración de Groq IA: [Ajustes del Sistema](#/admin/settings) -> "#/admin/settings" (Gestión de sede central, API de IA y políticas).
    - Gestión de Pacientes: [Gestión de Pacientes](#/patients) -> "#/patients".
    - Pacientes Archivados / Históricos: [Pacientes Archivados](#/patients/archived) -> "#/patients/archived".
    - Registrar Nuevo Paciente: [Registrar Paciente](#/patients/new) -> "#/patients/new" (Abre el formulario modal de apertura de expediente).
    - Directorio de Especialistas: [Especialistas Acreditados](#/therapists) -> "#/therapists".
  - Si el usuario es TUTOR:
    - Directorio de Especialistas del Centro: [Directorio de Especialistas](#/portal/therapists) -> "#/portal/therapists" (Página exclusiva para familias y tutores donde conocen al equipo médico, credenciales CPB y turnos).
    - Mi Perfil Familiar: [Mi Perfil](#/profile) -> "#/profile".
    - Seguimiento Clínico Familiar: [Dashboard](#/dashboard) -> "#/dashboard".
    - RESTRICCIÓN ESTRICTA DE PRIVACIDAD: Si un Tutor pregunta por personal desvinculado, bitácora de auditoría, gestión de usuarios o consultorios administrativos, DEBES NEGARLE EL ACCESO cordialmente por secreto profesional y seguridad.
  - Si el usuario es TERAPEUTA:
    - Mis Pacientes Asignados: [Mis Pacientes Asignados](#/patients/assigned) -> "#/patients/assigned".
    - Gestión de Pacientes: [Gestión de Pacientes](#/patients) -> "#/patients".
    - Registrar Nuevo Paciente: [Registrar Paciente](#/patients/new) -> "#/patients/new".
    - Directorio de Especialistas: [Especialistas Acreditados](#/therapists) -> "#/therapists".
    - RESTRICCIÓN: No tiene acceso a personal desvinculado, eliminación de usuarios ni auditoría administrativa.
  - Si el usuario es RECEPCION:
    - Registrar Nuevo Paciente: [Registrar Paciente](#/patients/new) -> "#/patients/new".
    - Gestión de Pacientes: [Gestión de Pacientes](#/patients) -> "#/patients".
    - Directorio de Especialistas: [Especialistas Acreditados](#/therapists) -> "#/therapists".
- REGLA DE ORO DE ENLACES:
  - En "respuesta_conversacional", incluye SIEMPRE el enlace Markdown interactivo con su nombre (ej. "[Personal Desvinculado](#/admin/users/inactive)").
  - En "enlaces_rapidos", incluye el botón con la ruta canónica exacta: [{"label": "Ver Personal Desvinculado", "url": "#/admin/users/inactive"}].
  - "reorientacion_institucional": DEBE SER null. NUNCA muestres enfoque institucional para preguntas del sistema o del centro.

PREGUNTAS PSICOEDUCATIVAS O CLÍNICAS CONCEPTUALES (ej. "¿Qué es la ansiedad?", "¿Cómo se diagnostica el TDAH?", "¿Qué es la dislexia?"):
- Explica el concepto con calidez, claridad y rigor científico.
- "requiere_aviso_profesional": true.
- "aviso_profesional": "Esta explicación es de carácter informativo y psicoeducativo basada en literatura científica; no sustituye ni equivale a una evaluación formal ni a un diagnóstico emitido por uno de nuestros profesionales con experiencia en el Centro PSI Aprende. Si deseas una valoración personalizada para tu caso, te invitamos a coordinar una sesión con nuestro equipo."
- "reorientacion_institucional": null.
- "es_triaje": false.

CONSULTAS GENERALES O AJENAS AL CENTRO (ej. Matemáticas, ciencia, poemas, historia):
- Responde la consulta con precisión y cortesía en "respuesta_conversacional".
- REGLA DE REORIENTACIÓN: En "reorientacion_institucional" añade la nota cordial:
  "Si bien con gusto puedo apoyarte con consultas generales, recuerda que mi misión principal en el Centro PSI Aprende es la orientación psicológica, psicopedagógica y la guía institucional para ti y tu familia. ¡Avísame si requieres apoyo en alguna de esas áreas!"
- "es_triaje": false.
- "requiere_aviso_profesional": false.

DATOS INSTITUCIONALES DEL CENTRO:
- Ubicación: ${instAddress} (Sede Central).
- Horarios: ${instHorario}.
- Consultorios: Ambientes físicos especialmente acondicionados (Infantil/Neuropsicología, Integral/Conductual, Adultos y Psicogerontología independiente, etc.).
- Equipo de terapeutas acreditados ante el Colegio de Psicólogos de Bolivia (CPB), con dirección general a cargo de la ${instDirectora}. Capacidad incremental según especialidades.

FORMATO JSON ESTRICTO OBLIGATORIO:
{
  "respuesta_conversacional": "Texto completo, fluido, empático y explicativo que le das al usuario.",
  "tipo_consulta": "CONVERSACION_GENERAL" | "PSICOEDUCACION_CLINICA" | "TRIAJE_CASO" | "GUIA_PLATAFORMA",
  "requiere_aviso_profesional": true | false,
  "aviso_profesional": "Texto ético si aplica o null",
  "reorientacion_institucional": "Recordatorio institucional únicamente si es off-topic o null",
  "es_triaje": true | false,
  "area_sugerida": "Área clínica o null",
  "nivel_urgencia": "Baja" | "Media" | "Alta" | null,
  "motivo_sintetizado": "Resumen breve si es triaje inicial o null",
  "preguntas_orientadoras": ["Pregunta 1", "Pregunta 2", "Pregunta 3"],
  "recomendacion_accion": "Breve recomendación o null",
  "enlaces_rapidos": [
    { "label": "Texto del botón", "url": "#/ruta" }
  ]
}
`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Incluir mensajes previos de contexto respetando la ventana deslizante
    if (Array.isArray(conversationHistory)) {
      conversationHistory.forEach(item => {
        if (item.sender === 'user' && item.text) {
          messages.push({ role: 'user', content: item.text });
        } else if (item.sender === 'bot') {
          const content = item.data?.respuesta_conversacional || item.text || item.rawText;
          if (content) {
            messages.push({ role: 'assistant', content });
          }
        }
      });
    }

    messages.push({ role: 'user', content: userMessage });

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.45,
          max_tokens: 1200,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Error HTTP ${response.status} en GroqCloud`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Respuesta vacía recibida desde GroqCloud');
      }

      const parsed = JSON.parse(rawContent);
      return parsed;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Timeout de inferencia superado (> ${timeoutMs}ms) en GroqCloud`);
      }
      throw err;
    }
  }

  /**
   * Motor Heurístico Local Offline basado en reglas semánticas clínicas y RBAC.
   * Funciona al 100% sin conexión a internet ni dependencia de API externa.
   */
  async _runLocalHeuristicEngine(text, userRole = 'TUTOR', userName = 'Usuario', hasPriorTriageInHistory = false, priorOffTopicCount = 0) {
    const lower = text.toLowerCase();

    // 0. Gobernanza RBAC en Heurística Offline
    if (/desvinculad|personal inactivo|inactiv|baja de personal|despedid/i.test(lower)) {
      if (userRole === 'ADMIN') {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'Para visualizar al personal que ha sido desvinculado del centro o cuyas cuentas se encuentran inactivas, puedes acceder directamente a la sección de [Personal Desvinculado](#/admin/users/inactive). Al hacer clic en el enlace, se abrirá la vista de usuarios con la pestaña de inactivos seleccionada automáticamente.',
          area_sugerida: 'Personal Desvinculado',
          nivel_urgencia: 'Baja',
          motivo_sintetizado: 'Consulta sobre el listado de personal desvinculado o inactivo.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Haz clic en el enlace para revisar las cuentas inactivas.',
          enlaces_rapidos: [{ label: 'Ver Personal Desvinculado', url: '#/admin/users/inactive' }]
        };
      } else {
        const roleLabel = userRole === 'TUTOR' ? 'tutor(a)/familiar' : (userRole === 'TERAPEUTA' ? 'terapeuta' : 'personal de recepción');
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: `Como ${roleLabel}, no tienes acceso a la información de personal desvinculado ni a las cuentas inactivas del sistema. Esta función está reservada exclusivamente para la Dirección General / Administración por políticas de confidencialidad institucional.`,
          area_sugerida: null,
          nivel_urgencia: null,
          motivo_sintetizado: null,
          preguntas_orientadoras: [],
          recomendacion_accion: null,
          enlaces_rapidos: []
        };
      }
    }

    if (/tutores|familias|cuentas de tutores/i.test(lower)) {
      if (userRole === 'ADMIN') {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'Para consultar el directorio de tutores y familias registradas, puedes ingresar directamente a [Directorio de Tutores](#/admin/users/tutors), donde se activará la pestaña correspondiente.',
          area_sugerida: 'Directorio de Familias y Tutores',
          nivel_urgencia: 'Baja',
          motivo_sintetizado: 'Consulta sobre el directorio de tutores.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Haz clic en el enlace para ver las cuentas de tutores.',
          enlaces_rapidos: [{ label: 'Directorio de Tutores', url: '#/admin/users/tutors' }]
        };
      }
    }

    if (/pacientes archivados|expedientes archivados|pacientes de baja/i.test(lower)) {
      if (userRole === 'ADMIN') {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'Para consultar los expedientes clínicos archivados o dados de baja, puedes ingresar directamente a [Pacientes Archivados](#/patients/archived).',
          area_sugerida: 'Pacientes Archivados',
          nivel_urgencia: 'Baja',
          motivo_sintetizado: 'Consulta sobre expedientes archivados.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Haz clic en el enlace para ver los expedientes archivados.',
          enlaces_rapidos: [{ label: 'Pacientes Archivados', url: '#/patients/archived' }]
        };
      }
    }

    if (/pacientes asignados|mis pacientes/i.test(lower)) {
      if (userRole === 'TERAPEUTA') {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'Puedes revisar tu lista de pacientes asignados directamente en [Mis Pacientes Asignados](#/patients/assigned).',
          area_sugerida: 'Pacientes Asignados',
          nivel_urgencia: 'Baja',
          motivo_sintetizado: 'Consulta sobre pacientes asignados al terapeuta.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Haz clic en el enlace para ver tus pacientes.',
          enlaces_rapidos: [{ label: 'Mis Pacientes Asignados', url: '#/patients/assigned' }]
        };
      }
    }

    if (/bitacora|auditor|seguridad|logs|registros de auditoria/i.test(lower)) {
      if (userRole === 'ADMIN') {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'La Bitácora Inalterable de Auditoría y Seguridad registra cada inicio de sesión, cambios de roles, apertura de expedientes y alertas de crisis con marca de tiempo e IP. Se encuentra en el módulo de [Gestión de Usuarios](#/admin/users). Al pulsar el enlace de abajo se abrirá directamente el modal con los registros.',
          area_sugerida: 'Bitácora de Auditoría y Seguridad',
          nivel_urgencia: 'Baja',
          motivo_sintetizado: 'Consulta sobre el registro inalterable de auditoría y trazabilidad.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Haz clic en el enlace para abrir directamente la Bitácora de Auditoría.',
          enlaces_rapidos: [{ label: 'Abrir Bitácora de Auditoría', url: '#/admin/audit' }]
        };
      } else {
        const roleLabel = userRole === 'TUTOR' ? 'tutor(a)/familiar' : (userRole === 'TERAPEUTA' ? 'terapeuta' : 'personal de recepción');
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: `Como ${roleLabel}, no tienes acceso a la Bitácora de Auditoría y Seguridad del sistema. Esta función está reservada exclusivamente para la Dirección General / Administración por políticas de confidencialidad institucional.`,
          area_sugerida: null,
          nivel_urgencia: null,
          motivo_sintetizado: null,
          preguntas_orientadoras: [],
          recomendacion_accion: null,
          enlaces_rapidos: []
        };
      }
    }

    if (/groq|clave api|configuracion de ia|api key|modelo llm/i.test(lower)) {
      if (userRole === 'ADMIN') {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'El Gestor en Caliente de GROQ_API_KEY se encuentra dentro de la sección de [Ajustes del Sistema](#/admin/settings). Te permite probar la conexión de los modelos LLaMA / Qwen y actualizar la clave en caliente sin reiniciar el servidor backend.',
          area_sugerida: 'Configuración de Inteligencia Artificial',
          nivel_urgencia: 'Baja',
          motivo_sintetizado: 'Consulta sobre el gestor de credenciales de GroqCloud IA.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Haz clic en el enlace para ir directamente a los Ajustes del Sistema.',
          enlaces_rapidos: [{ label: 'Ajustes del Sistema & IA', url: '#/admin/settings' }]
        };
      } else {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'La configuración de modelos de Inteligencia Artificial y claves de servidor está reservada exclusivamente al perfil de Administrador.',
          area_sugerida: null,
          nivel_urgencia: null,
          motivo_sintetizado: null,
          preguntas_orientadoras: [],
          recomendacion_accion: null,
          enlaces_rapidos: []
        };
      }
    }

    if (/nuevo paciente|registrar paciente|admitir paciente|crear paciente|abrir expediente/i.test(lower)) {
      if (['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(userRole)) {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'Para registrar la admisión de un nuevo paciente y aperturar su expediente clínico con validación en vivo de Cédula de Identidad, haz clic en el botón de abajo para abrir directamente el formulario de registro.',
          area_sugerida: 'Admisión y Apertura de Pacientes',
          nivel_urgencia: 'Baja',
          motivo_sintetizado: 'Consulta sobre el registro y admisión de nuevos pacientes.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Haz clic en el enlace para abrir el formulario de nuevo paciente.',
          enlaces_rapidos: [{ label: 'Registrar Nuevo Paciente', url: '#/patients/new' }]
        };
      }
    }

    if (/eliminar usuario|borrar usuario|eliminar cuenta|cambiar rol|modificar rol|crear rol|gestionar usuario/i.test(lower)) {
      if (userRole === 'ADMIN') {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'Para gestionar, crear o desactivar usuarios y asignar roles del personal, puedes acceder directamente a la sección de [Administración de Usuarios](#/admin/users). Desde allí podrás administrar las cuentas de terapeutas, recepción y tutores.',
          area_sugerida: 'Gestión Institucional de Usuarios',
          nivel_urgencia: 'Baja',
          motivo_sintetizado: 'Consulta administrativa de gestión y roles de usuarios.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Ingresa al módulo de usuarios para gestionar permisos.',
          enlaces_rapidos: [{ label: 'Administración de Usuarios', url: '#/admin/users' }]
        };
      } else {
        const roleLabel = userRole === 'TUTOR' ? 'tutor(a)/familiar' : (userRole === 'TERAPEUTA' ? 'terapeuta' : 'personal de recepción');
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: `Como ${roleLabel}, no cuentas con permisos para administrar o eliminar cuentas de usuario ni modificar roles del personal. Esta función está reservada exclusivamente para la Dirección General / Administración por políticas de seguridad del sistema. Si requieres asistencia técnica o ajustes en una cuenta, por favor comunícate con Dirección.`,
          area_sugerida: null,
          nivel_urgencia: null,
          motivo_sintetizado: null,
          preguntas_orientadoras: [],
          recomendacion_accion: null,
          enlaces_rapidos: []
        };
      }
    }

    if (/historial clinic|historia clinica|expediente|notas soap|anamnesis/i.test(lower)) {
      if (userRole === 'ADMIN' || userRole === 'TERAPEUTA') {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'Puedes consultar los expedientes clínicos, anamnesis y registrar notas de evolución en la sección de [Gestión de Pacientes](#/patients). Al seleccionar un paciente asignado podrás revisar todo su historial de atenciones.',
          area_sugerida: 'Expedientes Clínicos',
          nivel_urgencia: 'Baja',
          motivo_sintetizado: 'Consulta sobre acceso a expedientes clínicos de pacientes.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Ingresa al módulo de pacientes para revisar la documentación clínica.',
          enlaces_rapidos: [{ label: 'Gestión de Pacientes', url: '#/patients' }]
        };
      } else {
        return {
          tipo_consulta: 'GUIA_PLATAFORMA',
          es_triaje: false,
          requiere_aviso_profesional: false,
          reorientacion_institucional: null,
          respuesta_conversacional: 'Como tutor familiar, tienes acceso a consultar el seguimiento de las sesiones y citas de tu familiar a cargo, pero no a los expedientes clínicos de otros pacientes ni a registros confidenciales internos, de acuerdo con las normativas de secreto profesional médico y la Ley 3131. Si tienes dudas sobre la evolución de tu familiar, puedes coordinar una sesión de retroalimentación con el especialista asignado.',
          area_sugerida: null,
          nivel_urgencia: null,
          motivo_sintetizado: null,
          preguntas_orientadoras: [],
          recomendacion_accion: null,
          enlaces_rapidos: []
        };
      }
    }

    // Si ya existe un triaje activo en esta sesión y el usuario aporta más datos sobre la consulta
    if (hasPriorTriageInHistory && !/cuanto es|\bmatematica\b|\bcalcular\b|\bpoema\b|\bchiste\b/i.test(lower)) {
      return {
        tipo_consulta: 'TRIAJE_CASO',
        es_triaje: false,
        requiere_aviso_profesional: false,
        reorientacion_institucional: null,
        respuesta_conversacional: 'Entiendo perfectamente los datos adicionales que compartes. Toda esta información sobre los tiempos de manifestación y cómo afecta la rutina diaria es de gran valor para que el terapeuta del centro prepare la sesión de evaluación inicial. ¿Deseas que te oriente sobre cómo coordinar la cita o requieres información sobre los horarios disponibles?',
        area_sugerida: null,
        nivel_urgencia: null,
        motivo_sintetizado: null,
        preguntas_orientadoras: [],
        recomendacion_accion: null,
        enlaces_rapidos: [{ label: 'Ver Especialistas y Citas', url: '#/therapists' }]
      };
    }

    // 1. Detección de Guía de Navegación / Infraestructura Web
    if (/consultorio|sala|ambiente|instalacion|infraestructura/i.test(lower)) {
      return {
        tipo_consulta: 'GUIA_PLATAFORMA',
        es_triaje: false,
        requiere_aviso_profesional: false,
        reorientacion_institucional: null,
        respuesta_conversacional: 'El Centro Psicopedagógico y Psicológico "PSI Aprende" cuenta con consultorios físicos especialmente acondicionados en su Sede Central (Cochabamba):\n\n• **Consultorio 1:** Infantil, Neuropsicología y Psicopedagogía (dotado de material lúdico y sensorial).\n• **Consultorio 2:** Evaluación Integral y Terapia Conductual (adolescentes y dinámicas familiares).\n• **Consultorio 3:** Adultos y Psicogerontología (ambiente privado e independiente para nuestro programa Horizontes Plateados).\n\nPuedes revisar las características y disponibilidad de cada ambiente en la sección de [Consultorios y Salas](#/admin/rooms).',
        area_sugerida: 'Infraestructura de Consultorios',
        nivel_urgencia: 'Baja',
        motivo_sintetizado: 'Consulta sobre los consultorios físicos del centro y sus equipamientos especializados.',
        preguntas_orientadoras: [],
        recomendacion_accion: 'Revisa las especificaciones y disponibilidad de cada sala.',
        enlaces_rapidos: [{ label: 'Ver Consultorios y Salas', url: '#/admin/rooms' }]
      };
    }

    if (/terapeuta|especialista|psicolog|fonoaudiolog|directora|grisel|morales|mendez|bustamante|torrico/i.test(lower)) {
      return {
        tipo_consulta: 'GUIA_PLATAFORMA',
        es_triaje: false,
        requiere_aviso_profesional: false,
        reorientacion_institucional: null,
        respuesta_conversacional: 'Nuestro equipo clínico está conformado por especialistas acreditados ante el Colegio de Psicólogos de Bolivia, incluyendo entre otros a:\n\n1. **Mgr. Grisel Aguilar Apaza** (CPB-1402) - Dirección General y Neuropsicología Infantil.\n2. **Lic. Claudia Morales Soto** (CPB-2150) - Psicopedagogía y Dificultades de Aprendizaje.\n3. **Lic. Valeria Bustamante Ríos** (CPB-3318) - Psicogerontología Clínica y Adulto Mayor.\n4. **Lic. Rodrigo Méndez Salinas** (CPB-1944) - Psicología Clínica y Conductual.\n5. **Lic. Andrea Torrico Navia** (CPB-2891) - Terapia del Lenguaje y Fonoaudiología.\n\nPuedes consultar el directorio actualizado y turnos en la sección de [Especialistas Acreditados](#/therapists).',
        area_sugerida: 'Directorio de Especialistas',
        nivel_urgencia: 'Baja',
        motivo_sintetizado: 'Información sobre el equipo de profesionales acreditados y sus especialidades clínicas.',
        preguntas_orientadoras: [],
        recomendacion_accion: 'Revisa las especialidades acreditadas en nuestro directorio.',
        enlaces_rapidos: [{ label: 'Ver Especialistas Acreditados', url: '#/therapists' }]
      };
    }

    if (/pago|precio|costo|arancel|tarifa|qr|simple|transferencia|banco/i.test(lower)) {
      return {
        tipo_consulta: 'GUIA_PLATAFORMA',
        es_triaje: false,
        requiere_aviso_profesional: false,
        reorientacion_institucional: null,
        respuesta_conversacional: 'En PSI Aprende manejamos aranceles oficiales transparentes en moneda nacional (BOB):\n\n• **Evaluación Neuropsicológica Integral (90 min):** 220 Bs.\n• **Valoración Gerontológica Integral VGI (90 min):** 200 Bs.\n• **Consulta de Psicoterapia Adulto / Familiar (60 min):** 160 Bs.\n• **Sesión de Intervención Psicopedagógica (60 min):** 150 Bs.\n• **Sesión de Estimulación Neurocognitiva (45 min):** 130 Bs.\n\nContamos con cobro ágil mediante Simple QR desde cualquier banca móvil boliviana o en efectivo en recepción.',
        area_sugerida: 'Aranceles y Modalidades de Cobro',
        nivel_urgencia: 'Baja',
        motivo_sintetizado: 'Información sobre aranceles oficiales y pagos con Simple QR.',
        preguntas_orientadoras: [],
        recomendacion_accion: 'Las sesiones pueden abonarse por Simple QR o en caja.',
        enlaces_rapidos: [{ label: 'Ir al Panel Principal', url: '#/dashboard' }]
      };
    }

    if (/horario|atencion|cuando atienden|abierto|direccion|ubicacion|donde queda/i.test(lower)) {
      const instAddress = (this.configRepo ? await this.configRepo.getByKey('INSTITUCION_DIRECCION') : null) || 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba';
      const instHorario = (this.configRepo ? await this.configRepo.getByKey('INSTITUCION_HORARIO') : null) || 'Lunes a Viernes: 08:30 a 12:30 · Mañana, y 14:30 a 18:30 · Tarde.\n  - Sábados: 09:00 a 13:00.';
      const instTelefono = (this.configRepo ? await this.configRepo.getByKey('INSTITUCION_TELEFONO') : null) || '+591 4 4521234';
      const instWhatsapp = (this.configRepo ? await this.configRepo.getByKey('INSTITUCION_WHATSAPP') : null) || '+591 70012345';
      const instNombre = (this.configRepo ? await this.configRepo.getByKey('INSTITUCION_NOMBRE') : null) || 'PSI Aprende';

      return {
        tipo_consulta: 'GUIA_PLATAFORMA',
        es_triaje: false,
        requiere_aviso_profesional: false,
        reorientacion_institucional: null,
        respuesta_conversacional: `El Centro ${instNombre} se encuentra ubicado en:\n\n• **Dirección:** ${instAddress}.\n• **Horarios de Atención:**\n  - ${instHorario}\n• **Contacto Directo:** ${instTelefono} · WhatsApp: ${instWhatsapp}.`,
        area_sugerida: 'Atención Institucional y Ubicación',
        nivel_urgencia: 'Baja',
        motivo_sintetizado: 'Consulta de horarios y ubicación del centro.',
        preguntas_orientadoras: [],
        recomendacion_accion: 'Puedes acercarte en horario de atención o contactarnos por WhatsApp.',
        enlaces_rapidos: []
      };
    }

    // 2. Detección de Temas Psicoeducativos / Conceptuales (Ansiedad, TDAH, Dislexia, etc.)
    if (/que es la ansiedad|que es ansiedad|como se diagnostica|sintomas de|que es el tdah|que es la dislexia|que es el autismo|que es tea/i.test(lower)) {
      return {
        tipo_consulta: 'PSICOEDUCACION_CLINICA',
        es_triaje: false,
        requiere_aviso_profesional: true,
        aviso_profesional: 'Esta explicación tiene fines informativos y psicoeducativos basada en literatura clínica; no reemplaza ni equivale a una evaluación formal ni a un diagnóstico emitido por uno de los profesionales con experiencia en el Centro PSI Aprende. Si deseas una valoración personalizada, te invitamos a coordinar una cita con nuestro equipo.',
        reorientacion_institucional: null,
        respuesta_conversacional: 'Con mucho gusto te explico este tema desde la perspectiva neuropsicológica y clínica:\n\nLa sintomatología en el neurodesarrollo y la salud mental responde a la interacción entre factores neurobiológicos, emocionales y ambientales. Un diagnóstico formal nunca se realiza mediante una simple lista de cotejo aislada, sino a través de una evaluación integral que incluye:\n\n1. Anamnesis clínica exhaustiva con los tutores o el paciente.\n2. Aplicación de baterías neuropsicológicas estandarizadas con baremos actualizados (como WISC-V, CUMANES, ADOS-2).\n3. Observación clínica en sala y reportes ecológicos del entorno escolar o familiar.\n\nComprender el perfil cognitivo y emocional es el primer paso para diseñar una intervención personalizada y respetuosa.',
        area_sugerida: 'Psicoeducación Clínica',
        nivel_urgencia: 'Baja',
        motivo_sintetizado: 'Consulta psicoeducativa sobre conceptos clínicos y metodología diagnóstica.',
        preguntas_orientadoras: [],
        recomendacion_accion: 'Si deseas una evaluación formal para tu familiar, podemos orientarte con el especialista indicado.',
        enlaces_rapidos: [{ label: 'Ver Especialistas Acreditados', url: '#/therapists' }]
      };
    }

    // 3. Detección de Consultas Fuera de Tema (Off-Topic: Matemáticas, chistes, recetas, cultura general)
    if (!TriageService.isClinicOrCenterRelated(text) && TriageService.isExplicitOffTopic(text)) {
      if (userRole === 'TUTOR' && priorOffTopicCount >= 2) {
        return {
          tipo_consulta: 'LIMITE_OFFTOPIC_ALCANZADO',
          es_triaje: false,
          es_offtopic: true,
          requiere_aviso_profesional: false,
          reorientacion_institucional: 'Has alcanzado el límite de 3 preguntas fuera del ámbito del centro para usuarios tutores.',
          respuesta_conversacional: 'Estimado(a) tutor(a): Como asistente virtual oficial del Centro Psicopedagógico y Psicológico "PSI Aprende", mi propósito es orientarte exclusivamente en temas de psicología, psicopedagogía, neurodesarrollo y los servicios de nuestra institución. Para consultas de cultura general, tareas de otras materias o temas diversos, existen otras inteligencias artificiales de uso general (como ChatGPT o Gemini). Con el fin de preservar y optimizar los recursos del centro para la atención de las familias, te solicitamos enfocar tus consultas en el bienestar y la atención de tu familia en PSI Aprende.',
          area_sugerida: null,
          nivel_urgencia: null,
          motivo_sintetizado: 'Límite de 3 consultas fuera de tema alcanzado para el rol tutor.',
          preguntas_orientadoras: [],
          recomendacion_accion: 'Por favor realiza consultas vinculadas a la salud mental, dificultades de aprendizaje o servicios del centro.',
          enlaces_rapidos: [
            { label: 'Ver Especialistas del Centro', url: '#/portal/therapists' },
            { label: 'Ir a Mi Portal Familiar', url: '#/dashboard' }
          ]
        };
      }

      return {
        tipo_consulta: 'CONVERSACION_GENERAL',
        es_triaje: false,
        es_offtopic: true,
        requiere_aviso_profesional: false,
        reorientacion_institucional: 'Como asistente del Centro PSI Aprende, me complace ayudarte con cualquier duda general o académica, pero recuerda que mi especialidad principal es el bienestar psicológico, el neurodesarrollo y la psicopedagogía de tu familia. ¡Dime si en algún momento necesitas apoyo en esas áreas!',
        respuesta_conversacional: '¡Con gusto te ayudo con tu consulta! Comprendo tu pregunta y aquí tienes la explicación detallada paso a paso para resolverla con claridad.',
        area_sugerida: null,
        nivel_urgencia: null,
        motivo_sintetizado: null,
        preguntas_orientadoras: [],
        recomendacion_accion: null,
        enlaces_rapidos: []
      };
    }

    // 4. Detección Clínica por Especialidad Médica (Casos Clínicos Reales Iniciales)

    // A. Psicogerontología y Adulto Mayor
    if (/adult(o|a) mayor|abuel(o|a)|ancian(o|a)|olvido|memoria|alzheimer|demencia|deterioro cognitivo|geronto|horizontes plateados|vgi/i.test(lower)) {
      return {
        tipo_consulta: 'TRIAJE_CASO',
        es_triaje: true,
        requiere_aviso_profesional: true,
        aviso_profesional: 'Esta orientación se basa en literatura psicogerontológica; no sustituye la valoración clínica presencial de nuestros especialistas acreditados en PSI Aprende.',
        reorientacion_institucional: null,
        respuesta_conversacional: 'Comprendo perfectamente tu preocupación por tu familiar. En los adultos mayores, las quejas de memoria y las fallas atencionales pueden deberse tanto a procesos benignos asociados a la edad como a etapas tempranas de deterioro neurocognitivo que se benefician enormemente de una estimulación oportuna.\n\nEn nuestro centro contamos con el programa especializado "Horizontes Plateados", coordinado por la Lic. Valeria Bustamante en un consultorio independiente y tranquilo (Consultorio 3), donde se realiza una Valoración Gerontológica Integral (VGI) para evaluar funciones ejecutivas, memoria episódica y actividades de la vida diaria.',
        area_sugerida: 'Psicogerontología y Adulto Mayor',
        nivel_urgencia: /desorient|perdid|no reconoce|grave|crisis/i.test(lower) ? 'Alta' : 'Media',
        motivo_sintetizado: 'Quejas subjetivas de memoria, prevención de deterioro neurocognitivo o valoración geriátrica integral.',
        preguntas_orientadoras: [
          '¿Desde hace cuántos meses se han vuelto más notorios los olvidos cotidianos?',
          '¿Presenta dificultad para recordar fechas, nombres familiares o ubicarse en calles conocidas?',
          '¿Ha existido algún cambio notable en su estado de ánimo, apatía o irritabilidad?'
        ],
        recomendacion_accion: 'Recomendamos programar una Valoración Gerontológica Integral (VGI) con la Lic. Valeria Bustamante en el Consultorio 3.',
        enlaces_rapidos: [{ label: 'Agendar con Lic. Valeria Bustamante', url: '#/therapists' }]
      };
    }

    // B. Neuropsicología Infantil (TDAH / TEA)
    if (/tdah|hiperactiv|atenci[oó]n|concentra|inquiet|impulsiv|autism|tea|asperger|cerebr|evaluaci[oó]n neuro/i.test(lower)) {
      return {
        tipo_consulta: 'TRIAJE_CASO',
        es_triaje: true,
        requiere_aviso_profesional: true,
        aviso_profesional: 'La orientación preliminar no constituye un diagnóstico clínico formal. Se requiere la administración de pruebas estandarizadas por parte de un neuropsicólogo acreditado.',
        reorientacion_institucional: null,
        respuesta_conversacional: 'Entiendo profundamente la inquietud que esto genera en la familia y el colegio. Cuando un niño presenta dificultades persistentes para mantener la atención, regular su nivel de actividad motora o controlar impulsos, no se trata de desobediencia o falta de voluntad, sino de un ritmo particular en la maduración de las funciones ejecutivas del cerebro.\n\nEn PSI Aprende, la Directora General Mgr. Grisel Aguilar Apaza realiza valoraciones neuropsicológicas exhaustivas en el Consultorio Infantil utilizando baterías científicas estandarizadas (como WISC-V y pruebas de control inhibitorio) para identificar con exactitud el perfil de fortalezas y necesidades de tu hijo.',
        area_sugerida: 'Neuropsicología Infantil',
        nivel_urgencia: /suspensi[oó]n|agresiv|expuls/i.test(lower) ? 'Alta' : 'Media',
        motivo_sintetizado: 'Sospecha o sintomatología compatible con desatención, hiperactividad o condición del neurodesarrollo.',
        preguntas_orientadoras: [
          '¿La dificultad para mantener la atención se presenta tanto en el colegio como en el hogar?',
          '¿Tiende a perder objetos de trabajo escolar o le cuesta finalizar instrucciones secuenciales?',
          '¿Cómo reacciona ante cambios imprevistos en su rutina diaria o ante estímulos sonoros intensos?'
        ],
        recomendacion_accion: 'Se aconseja una Evaluación Neuropsicológica Integral con la Mgr. Grisel Aguilar Apaza en el Consultorio Infantil.',
        enlaces_rapidos: [{ label: 'Agendar con Mgr. Grisel Aguilar', url: '#/therapists' }]
      };
    }

    // C. Psicopedagogía (Dificultades Escolares / Lectoescritura)
    if (/lectur|leer|escrib|letras|dislexi|discalculi|disgraf|matem[aá]tic|tarea|colegio|reprob|aprendizaje|rendimiento escolar/i.test(lower)) {
      return {
        tipo_consulta: 'TRIAJE_CASO',
        es_triaje: true,
        requiere_aviso_profesional: true,
        aviso_profesional: 'El informe oficial y el plan psicopedagógico individualizado deben ser elaborados de manera personalizada por la especialista del centro.',
        reorientacion_institucional: null,
        respuesta_conversacional: 'Es muy comprensible tu preocupación al notar que el aprendizaje le cuesta más de lo esperado. Las dificultades en la lectura, la confusión de letras (como b/d o p/q), los bloqueos en matemáticas o la lentitud en la escritura suelen vincularse a dificultades específicas del aprendizaje (como dislexia o discalculia) que con la intervención adecuada tienen excelente pronóstico.\n\nNuestra especialista en Psicopedagogía, la Lic. Claudia Morales Soto, diseña planes terapéuticos individualizados que fortalecen la conciencia fonológica y el razonamiento lógico, devolviéndole la confianza y la alegría de aprender al estudiante.',
        area_sugerida: 'Psicopedagogía',
        nivel_urgencia: 'Media',
        motivo_sintetizado: 'Dificultad específica en procesos de adquisición de la lectura, escritura o razonamiento lógico-matemático.',
        preguntas_orientadoras: [
          '¿Confunde letras con orientación similar (como b/d o p/q) al leer o redactar?',
          '¿Cuánto tiempo le toma completar las tareas escolares habituales en la tarde?',
          '¿El profesor de aula ha reportado rezago en comparación con su grupo de edad?'
        ],
        recomendacion_accion: 'Sugerimos una sesión de valoración psicopedagógica con la Lic. Claudia Morales Soto.',
        enlaces_rapidos: [{ label: 'Agendar con Lic. Claudia Morales', url: '#/therapists' }]
      };
    }

    // D. Fonoaudiología y Terapia del Lenguaje
    if (/habla|pronunci|lenguaje|tartamud|traba|palabras|no habla|vocaliz|dislali/i.test(lower)) {
      return {
        tipo_consulta: 'TRIAJE_CASO',
        es_triaje: true,
        requiere_aviso_profesional: true,
        aviso_profesional: 'Esta orientación psicoeducativa no reemplaza la exploración fonoaudiológica directa de los órganos fonoarticulatorios.',
        reorientacion_institucional: null,
        respuesta_conversacional: 'El lenguaje es la herramienta fundamental de comunicación y socialización. Si observas que a tu niño le cuesta pronunciar ciertos sonidos (como la /r/ o la /s/), si presenta bloqueos al hablar o si su vocabulario parece estar rezagado para su edad, una estimulación fonoaudiológica temprana previene futuras dificultades en la lectura y la autoestima.\n\nEn nuestro centro, la Lic. Andrea Torrico Navia realiza evaluaciones lúdicas del aparato fonoarticulatorio y diseña ejercicios divertidos y efectivos para el hogar y la sala.',
        area_sugerida: 'Terapia del Lenguaje y Fonoaudiología',
        nivel_urgencia: 'Media',
        motivo_sintetizado: 'Dificultad en fluidez verbal, articulación fonética o retraso en la adquisición del código lingüístico.',
        preguntas_orientadoras: [
          '¿Qué sonidos o palabras específicas le resulta más complejo articular?',
          '¿Las personas ajenas a la familia logran comprender lo que expresa espontáneamente?',
          '¿Se observan bloqueos, repeticiones o tensión al intentar iniciar una frase?'
        ],
        recomendacion_accion: 'Se aconseja una evaluación del lenguaje y articulación fonológica con la Lic. Andrea Torrico.',
        enlaces_rapidos: [{ label: 'Agendar con Lic. Andrea Torrico', url: '#/therapists' }]
      };
    }

    // E. Psicología Clínica y Conductual (Emocional / Conducta)
    if (/ansiedad|miedo|p[aá]nico|trist|depresi|llanto|berrinche|agresiv|rabia|conducta|autoestima|duelo|separaci[oó]n|familiar/i.test(lower)) {
      return {
        tipo_consulta: 'TRIAJE_CASO',
        es_triaje: true,
        requiere_aviso_profesional: true,
        aviso_profesional: 'La orientación inicial no sustituye un proceso psicoterapéutico profesional formal bajo supervisión colegiada.',
        reorientacion_institucional: null,
        respuesta_conversacional: 'Las manifestaciones de ansiedad, cambios abruptos en el estado de ánimo, berrinches intensos o conductas desafiantes suelen ser la manera en que niños, adolescentes y adultos expresan un malestar emocional que aún no logran poner en palabras.\n\nEl Lic. Rodrigo Méndez Salinas, psicólogo clínico de nuestro centro, ofrece un espacio cálido, seguro y confidencial en el Consultorio 2 para trabajar tanto con el paciente como con los padres en pautas de crianza positiva y regulación emocional.',
        area_sugerida: 'Psicología Clínica y Conductual',
        nivel_urgencia: /p[aá]nico|desesperad|incontrolable/i.test(lower) ? 'Alta' : 'Media',
        motivo_sintetizado: 'Dificultad en regulación emocional, sintomatología ansiosa o desajuste en pautas de conducta familiar.',
        preguntas_orientadoras: [
          '¿En qué momentos o circunstancias del día se intensifican los episodios de ansiedad o enojo?',
          '¿Se han presentado alteraciones en los patrones de sueño, pesadillas o cambios en la alimentación?',
          '¿Ha ocurrido algún evento reciente de cambio relevante (mudanza, pérdida familiar, separación)?'
        ],
        recomendacion_accion: 'Recomendamos coordinar una consulta de psicoterapia clínica con el Lic. Rodrigo Méndez Salinas.',
        enlaces_rapidos: [{ label: 'Agendar con Lic. Rodrigo Méndez', url: '#/therapists' }]
      };
    }

    // F. Fallback General Amable
    return {
      tipo_consulta: 'CONVERSACION_GENERAL',
      es_triaje: false,
      es_offtopic: false,
      requiere_aviso_profesional: false,
      reorientacion_institucional: null,
      respuesta_conversacional: '¡Hola! Qué gusto saludarte. Estoy aquí para acompañarte, responder tus preguntas y orientarte con calidez en todo lo relacionado con el neurodesarrollo, la psicología y los servicios del Centro PSI Aprende.\n\n¿En qué puedo orientarte hoy?',
      area_sugerida: null,
      nivel_urgencia: null,
      motivo_sintetizado: null,
      preguntas_orientadoras: [],
      recomendacion_accion: null,
      enlaces_rapidos: []
    };
  }

  /**
   * Obtiene el historial de triajes para revisión administrativa o clínica.
   */
  async getTriageHistory(options = {}) {
    return this.triageRepo.findAll(options);
  }

  /**
   * Obtiene métricas globales de triaje.
   */
  async getTriageMetrics() {
    return this.triageRepo.getMetrics();
  }
}
