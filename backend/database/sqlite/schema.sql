-- ==============================================================================
-- SISTEMA WEB PWA "PSI APRENDE" (COCHABAMBA - BOLIVIA)
-- ESQUEMA BASE DE DATOS SQLITE (FASE 1) - MODO WAL ACTIVADO
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. ROLES DE USUARIO (RBAC)
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL, -- 'ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR'
  descripcion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. USUARIOS DEL SISTEMA
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_completo TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  rol_id INTEGER NOT NULL,
  telefono TEXT,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  ultimo_acceso DATETIME,
  fecha_desvinculacion DATETIME,
  motivo_desvinculacion TEXT,
  desvinculado_por_id INTEGER,
  firma_digital_blob TEXT,
  firma_actualizada_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE RESTRICT,
  FOREIGN KEY (desvinculado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 3. INFRAESTRUCTURA DE LOS 3 CONSULTORIOS FÍSICOS
CREATE TABLE IF NOT EXISTS ambientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL, -- 'CONS-01', 'CONS-02', 'CONS-03'
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'INFANTIL', 'INTEGRAL_CONDUCTUAL', 'ADULTOS_GERONTOLOGIA'
  descripcion TEXT,
  capacidad INTEGER DEFAULT 4,
  color_identificador TEXT DEFAULT '#2563eb',
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. ESPECIALIDADES CLÍNICAS ACREDITADAS
CREATE TABLE IF NOT EXISTS especialidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  color TEXT DEFAULT '#7c3aed',
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. SERVICIOS TERAPÉUTICOS Y ARANCELES (EN BOLIVIANOS - BOB)
CREATE TABLE IF NOT EXISTS servicios_aranceles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  especialidad_id INTEGER,
  duracion_minutos INTEGER DEFAULT 60 CHECK (duracion_minutos > 0),
  margen_ventilacion_minutos INTEGER DEFAULT 10 CHECK (margen_ventilacion_minutos >= 0),
  arancel_bob REAL NOT NULL CHECK (arancel_bob >= 0),
  descripcion TEXT,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (especialidad_id) REFERENCES especialidades(id) ON DELETE SET NULL
);

-- 6. CONFIGURACIONES DEL SISTEMA (GESTOR EN CALIENTE DE IA Y PARÁMETROS)
CREATE TABLE IF NOT EXISTS configuraciones_sistema (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clave TEXT UNIQUE NOT NULL COLLATE NOCASE,
  valor TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'GENERAL', -- 'IA', 'INSTITUCIONAL', 'FINANZAS'
  es_secreto INTEGER DEFAULT 0 CHECK (es_secreto IN (0, 1)),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 7. BITÁCORA INALTERABLE DE AUDITORÍA Y SEGURIDAD
CREATE TABLE IF NOT EXISTS bitacora_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  usuario_nombre_snapshot TEXT,
  usuario_email_snapshot TEXT,
  rol_nombre_snapshot TEXT,
  accion TEXT NOT NULL,
  modulo TEXT NOT NULL,
  detalles TEXT,
  ip_origen TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 8. TERAPEUTAS Y ESPECIALISTAS CLÍNICOS (MÓDULO C)
CREATE TABLE IF NOT EXISTS terapeutas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER UNIQUE,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  registro_profesional TEXT UNIQUE NOT NULL, -- Matrícula del Colegio de Psicólogos de Bolivia (ej. CPB-1402)
  especialidad_id INTEGER,
  ambiente_preferido_id INTEGER,
  telefono TEXT,
  porcentaje_honorarios REAL DEFAULT 70.00 CHECK (porcentaje_honorarios >= 0 AND porcentaje_honorarios <= 100),
  color_agenda TEXT DEFAULT '#7c3aed',
  bio TEXT,
  turnos_atencion TEXT DEFAULT 'MAÑANA_TARDE',
  firma_digital_blob TEXT,
  firma_actualizada_at DATETIME,
  qr_cobro_url TEXT,
  banco_nombre TEXT,
  cuenta_numero TEXT,
  cuenta_titular TEXT,
  arancel_base_bob REAL DEFAULT 150.00,
  qr_fecha_vencimiento TEXT,
  foto_url TEXT,
  titulos_academicos TEXT,
  diplomados_certificaciones TEXT,
  experiencia_anios TEXT,
  enfoque_terapeutico TEXT,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (especialidad_id) REFERENCES especialidades(id) ON DELETE SET NULL,
  FOREIGN KEY (ambiente_preferido_id) REFERENCES ambientes(id) ON DELETE SET NULL
);

-- 8.1 TARIFARIO DINÁMICO DE SERVICIOS POR ESPECIALISTA (SPRINT 10)
CREATE TABLE IF NOT EXISTS terapeutas_servicios_precios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE CASCADE,
  servicio_id INTEGER NOT NULL REFERENCES servicios_aranceles(id) ON DELETE CASCADE,
  arancel_bob REAL NOT NULL CHECK (arancel_bob >= 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(terapeuta_id, servicio_id)
);

-- 9. TUTORES LEGALES Y RED FAMILIAR (MÓDULO B)
CREATE TABLE IF NOT EXISTS tutores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  ci TEXT,
  parentesco TEXT DEFAULT 'MADRE', -- 'MADRE', 'PADRE', 'TUTOR_LEGAL', 'ABUELO_A', 'OTRO'
  ocupacion TEXT,
  whatsapp TEXT NOT NULL, -- Formato Bolivia (+591 XXXXXXXX)
  telefono_emergencia TEXT,
  direccion TEXT,
  email TEXT,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 10. PACIENTES Y EXPEDIENTES CLÍNICOS (MÓDULO B)
CREATE TABLE IF NOT EXISTS pacientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_expediente TEXT UNIQUE NOT NULL, -- Código institucional correlativo: 'PSI-A-XXXX'
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  ci TEXT NOT NULL, -- Cédula de Identidad boliviana obligatoria
  fecha_nacimiento DATE NOT NULL,
  sexo TEXT NOT NULL CHECK (sexo IN ('M', 'F', 'OTRO')),
  colegio_ocupacion TEXT,
  antecedentes_medicos TEXT,
  antecedentes_perinatales TEXT,
  medicacion_actual TEXT,
  estado_clinico TEXT DEFAULT 'ACTIVO' CHECK (estado_clinico IN ('ACTIVO', 'EN_EVALUACION', 'ALTA', 'SUSPENDIDO')),
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_por_usuario_id INTEGER,
  terapeuta_id INTEGER, -- Terapeuta de cabecera asignado actualmente
  eliminado_por_usuario_id INTEGER,
  fecha_eliminacion DATETIME,
  motivo_baja TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (terapeuta_id) REFERENCES terapeutas(id) ON DELETE SET NULL,
  FOREIGN KEY (eliminado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 11. DERIVACIONES CLÍNICAS INTERDISCIPLINARIAS
CREATE TABLE IF NOT EXISTS derivaciones_pacientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  terapeuta_origen_id INTEGER,
  terapeuta_destino_id INTEGER NOT NULL,
  usuario_responsable_id INTEGER,
  motivo TEXT NOT NULL,
  notas TEXT,
  estado TEXT DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'COMPLETADA', 'CANCELADA')),
  fecha_derivacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (terapeuta_origen_id) REFERENCES terapeutas(id) ON DELETE SET NULL,
  FOREIGN KEY (terapeuta_destino_id) REFERENCES terapeutas(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 12. RELACIÓN FAMILIAR: PACIENTE <-> TUTORES (MÚLTIPLES TUTORES / RED DE HERMANOS)
CREATE TABLE IF NOT EXISTS paciente_tutor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  tutor_id INTEGER NOT NULL,
  parentesco TEXT,
  es_principal INTEGER DEFAULT 1 CHECK (es_principal IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE CASCADE,
  UNIQUE(paciente_id, tutor_id)
);

-- 13. REGISTRO DE TRIAJES CLÍNICOS Y ORIENTACIÓN IA (MÓDULO D - MINDBOT)
CREATE TABLE IF NOT EXISTS triajes_clinicos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id TEXT,
  usuario_id INTEGER,
  motivo_consulta TEXT NOT NULL,
  motivo_anonimizado TEXT,
  area_sugerida TEXT NOT NULL,
  nivel_urgencia TEXT NOT NULL,
  motivo_sintetizado TEXT,
  preguntas_orientadoras TEXT, -- JSON array en formato texto
  recomendacion_accion TEXT,
  es_crisis INTEGER DEFAULT 0 CHECK (es_crisis IN (0, 1)),
  motor_utilizado TEXT, -- 'GROQ_LLAMA_3.3', 'GROQ_QWEN', 'FALLBACK_HEURISTICO_OFFLINE', 'FILTRO_CRISIS'
  ip_origen TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 14. HISTORIAS CLÍNICAS DIGITALES UNIFICADAS (MÓDULO E - SPRINT 4)
CREATE TABLE IF NOT EXISTS historias_clinicas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL UNIQUE,
  numero_expediente TEXT NOT NULL UNIQUE,
  fecha_apertura DATE NOT NULL DEFAULT CURRENT_DATE,
  estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'EN_EVALUACION', 'ALTA', 'SUSPENDIDO')),
  observaciones_ingreso TEXT,
  triaje_origen_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (triaje_origen_id) REFERENCES triajes_clinicos(id) ON DELETE SET NULL
);

-- 15. EVALUACIÓN INICIAL / ANAMNESIS CLÍNICA (MÓDULO E - SPRINT 4)
CREATE TABLE IF NOT EXISTS anamnesis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  historia_id INTEGER NOT NULL UNIQUE,
  motivo_consulta TEXT NOT NULL,
  historia_problema_actual TEXT,
  antecedentes_perinatales TEXT,
  desarrollo_motor_lenguaje TEXT,
  antecedentes_medicos TEXT,
  antecedentes_familiares TEXT,
  dinamica_familiar_escolar TEXT,
  exploracion_cognitiva_conductual TEXT,
  impresion_diagnostica_inicial TEXT,
  evaluador_id INTEGER,
  fecha_evaluacion DATE DEFAULT CURRENT_DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluador_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 16. NOTAS DE EVOLUCIÓN CONTINUA SOAP (MÓDULO E - RN-07 - SPRINT 4)
CREATE TABLE IF NOT EXISTS notas_evolucion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  historia_id INTEGER NOT NULL,
  paciente_id INTEGER NOT NULL,
  terapeuta_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  numero_sesion INTEGER NOT NULL DEFAULT 1,
  fecha_sesion DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TEXT,
  hora_fin TEXT,
  ambiente_id INTEGER,
  subjetivo TEXT NOT NULL,       -- (S) Lo relatado por el tutor o el paciente
  objetivo TEXT NOT NULL,         -- (O) Observaciones clínicas, pruebas aplicadas, reactivos
  analisis TEXT NOT NULL,         -- (A) Apreciación diagnóstica, evolución del caso
  plan TEXT NOT NULL,             -- (P) Plan para la siguiente sesión e indicaciones
  diagnostico_codigo TEXT,        -- Código CIE-11 / DSM-5 preliminar
  diagnostico_glosa TEXT,
  recomendaciones_hogar TEXT,     -- Pautas claras compartibles con la familia
  asistido_por_ia INTEGER DEFAULT 0 CHECK (asistido_por_ia IN (0, 1)),
  sellado INTEGER DEFAULT 1 CHECK (sellado IN (0, 1)), -- Inalterable (RN-07)
  firma_digital_snapshot TEXT,    -- Nombre, matrícula CPB y rol del firmante
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (terapeuta_id) REFERENCES terapeutas(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (ambiente_id) REFERENCES ambientes(id) ON DELETE SET NULL
);

-- 17. CATÁLOGO NOSOLÓGICO CLÍNICO CIE-11 / DSM-5 (MÓDULO E - HU-08 - SPRINT 5)
CREATE TABLE IF NOT EXISTS catalogo_diagnosticos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sistema TEXT NOT NULL,                     -- 'CIE-11', 'DSM-5', 'AMBOS'
  codigo TEXT UNIQUE NOT NULL COLLATE NOCASE,-- Ej: 'F90.2', 'F84.0', '6D80', 'F81.0'
  nombre TEXT NOT NULL,                      -- Ej: 'Trastorno por Déficit de Atención con Hiperactividad, presentación combinada'
  categoria TEXT NOT NULL,                   -- 'NEURODESARROLLO', 'NEUROCOGNITIVO_ADULTO', 'APRENDIZAJE', 'AFECTIVO_CONDUCTUAL', 'LENGUAJE_HABLA'
  descripcion TEXT,
  criterios_resumen TEXT,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 18. CARPETAS DIGITALES DEL EXPEDIENTE (MÓDULO E - HU-08 - SPRINT 5)
CREATE TABLE IF NOT EXISTS paciente_carpetas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  es_sistema INTEGER DEFAULT 0 CHECK (es_sistema IN (0, 1)), -- 1 para carpetas fijas institucionales
  orden INTEGER DEFAULT 0,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  motivo_baja TEXT,
  fecha_baja DATETIME,
  creado_por_usuario_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 19. DOCUMENTOS, ESTUDIOS EXTERNOS Y LABORATORIOS (MÓDULO E - HU-08 - SPRINT 5)
CREATE TABLE IF NOT EXISTS paciente_documentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carpeta_id INTEGER NOT NULL,
  paciente_id INTEGER NOT NULL,
  nombre_original TEXT NOT NULL,
  nombre_almacenado TEXT NOT NULL UNIQUE,     -- UUID seguro sin datos de filiación en disco
  tipo_mime TEXT NOT NULL,                   -- 'application/pdf', 'image/jpeg', 'image/png'
  tamano_bytes INTEGER NOT NULL,
  categoria_clinica TEXT DEFAULT 'ESTUDIO_EXTERNO', -- 'LABORATORIO_ESTUDIO', 'EVALUACION_NEUROPSICOLOGICA', 'INFORME_ESCOLAR', 'CONSENTIMIENTO_LEGAL', 'OTRO'
  descripcion TEXT,
  subido_por_usuario_id INTEGER NOT NULL,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)), -- Soft Delete obligatorio
  motivo_anulacion TEXT,
  anulado_por_usuario_id INTEGER,
  fecha_anulacion DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (carpeta_id) REFERENCES paciente_carpetas(id) ON DELETE RESTRICT,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (subido_por_usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (anulado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 20. PLANES TERAPÉUTICOS INDIVIDUALIZADOS - PTI (MÓDULO F - HU-09 - SPRINT 5)
CREATE TABLE IF NOT EXISTS planes_intervencion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  historia_id INTEGER NOT NULL,
  paciente_id INTEGER NOT NULL,
  terapeuta_id INTEGER NOT NULL,
  diagnostico_codigo TEXT,
  diagnostico_glosa TEXT,
  diagnostico_catalogo_id INTEGER,
  titulo TEXT NOT NULL,
  objetivo_general TEXT NOT NULL,
  periodicidad_meses INTEGER DEFAULT 3 CHECK (periodicidad_meses IN (1, 2, 3, 6, 12)),
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_revision DATE,
  recomendaciones_familia TEXT,
  estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'CUMPLIDO', 'DESCONTINUADO')),
  motivo_cierre TEXT,
  cerrado_por_usuario_id INTEGER,
  fecha_cierre DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (terapeuta_id) REFERENCES terapeutas(id) ON DELETE RESTRICT,
  FOREIGN KEY (diagnostico_catalogo_id) REFERENCES catalogo_diagnosticos(id) ON DELETE SET NULL,
  FOREIGN KEY (cerrado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 21. METAS TERAPÉUTICAS SMART (MÓDULO F - HU-09 - SPRINT 5)
CREATE TABLE IF NOT EXISTS metas_terapeuticas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  descripcion_meta TEXT NOT NULL,
  area_intervencion TEXT NOT NULL,           -- 'ATENCION_CONCENTRACION', 'FUNCIONES_EJECUTIVAS', 'MEMORIA', 'LECTOESCRITURA', 'CALCULO_LOGICO', 'LENGUAJE_COMUNICACION', 'REGULACION_CONDUCTUAL', 'SOCIOEMOCIONAL', 'PSICOMOTRICIDAD'
  criterio_exito TEXT NOT NULL,
  porcentaje_logro INTEGER DEFAULT 0 CHECK (porcentaje_logro IN (0, 25, 50, 75, 100)),
  estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'CONSOLIDADA')),
  pautas_hogar TEXT,                         -- Pauta adaptada al tutor y familia para casa
  orden INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES planes_intervencion(id) ON DELETE CASCADE
);

-- 22. TRAZABILIDAD Y SEGUIMIENTO HISTÓRICO DE METAS (MÓDULO F - HU-09 - SPRINT 5)
CREATE TABLE IF NOT EXISTS seguimiento_metas_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meta_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  paciente_id INTEGER NOT NULL,
  terapeuta_id INTEGER NOT NULL,
  porcentaje_anterior INTEGER NOT NULL,
  nuevo_porcentaje INTEGER NOT NULL,
  observaciones_clinicas TEXT,
  sesion_numero INTEGER,
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meta_id) REFERENCES metas_terapeuticas(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES planes_intervencion(id) ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (terapeuta_id) REFERENCES terapeutas(id) ON DELETE RESTRICT
);

-- 23. AGENDA Y CITAS MÉDICAS EN 3 CONSULTORIOS (MÓDULO G - HU-10 - SPRINT 6)
CREATE TABLE IF NOT EXISTS citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  terapeuta_id INTEGER NOT NULL,
  ambiente_id INTEGER NOT NULL,
  servicio_id INTEGER,
  servicio_personalizado TEXT,
  arancel_personalizado REAL,
  fecha_hora_inicio DATETIME NOT NULL,
  fecha_hora_fin DATETIME NOT NULL,
  duracion_minutos INTEGER NOT NULL DEFAULT 45,
  estado TEXT NOT NULL DEFAULT 'PROGRAMADA' CHECK (estado IN ('PROGRAMADA', 'CONFIRMADA', 'EN_ATENCION', 'ATENDIDA', 'REPROGRAMADA', 'CANCELADA', 'AUSENTE')),
  motivo_consulta TEXT,
  motivo_cancelacion TEXT,
  notas_internas TEXT,
  reprogramada_de_cita_id INTEGER,
  creado_por_usuario_id INTEGER,
  asistencia_registrada_at DATETIME,
  asistencia_registrada_por_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (terapeuta_id) REFERENCES terapeutas(id) ON DELETE RESTRICT,
  FOREIGN KEY (ambiente_id) REFERENCES ambientes(id) ON DELETE RESTRICT,
  FOREIGN KEY (servicio_id) REFERENCES servicios_aranceles(id) ON DELETE SET NULL,
  FOREIGN KEY (reprogramada_de_cita_id) REFERENCES citas(id) ON DELETE SET NULL,
  FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (asistencia_registrada_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 24. SESIONES DE WHATSAPP MULTI-INSTANCIA AISLADAS (MÓDULO H - HU-11 - SPRINT 7)
CREATE TABLE IF NOT EXISTS whatsapp_sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terapeuta_id INTEGER NOT NULL UNIQUE,
  estado TEXT NOT NULL DEFAULT 'DESCONECTADO' CHECK (estado IN ('DESCONECTADO', 'INICIALIZANDO', 'ESPERANDO_QR', 'CONECTADO')),
  telefono_vinculado TEXT,
  nombre_dispositivo TEXT,
  ultimo_qr_generado_at DATETIME,
  ultimo_mensaje_at DATETIME,
  conectado_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (terapeuta_id) REFERENCES terapeutas(id) ON DELETE CASCADE
);

-- 25. SUSCRIPCIONES WEB PUSH (MÓDULO H - HU-12 - SPRINT 8)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 26. CENTRO DE ALERTAS Y NOTIFICACIONES IN-APP (MÓDULO H - HU-12 - SPRINT 8)
CREATE TABLE IF NOT EXISTS notificaciones_sistema (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'RECORDATORIO', -- 'RECORDATORIO_24H', 'RECORDATORIO_2H', 'CONFIRMACION_CITA', 'SISTEMA'
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leida INTEGER DEFAULT 0 CHECK (leida IN (0, 1)),
  link_url TEXT,
  cita_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL
);

-- ÍNDICES DE VELOCIDAD
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_config_clave ON configuraciones_sistema(clave);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON bitacora_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_terapeutas_usuario ON terapeutas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_terapeutas_especialidad ON terapeutas(especialidad_id);
CREATE INDEX IF NOT EXISTS idx_tutores_ci ON tutores(ci);
CREATE INDEX IF NOT EXISTS idx_tutores_whatsapp ON tutores(whatsapp);
CREATE INDEX IF NOT EXISTS idx_pacientes_codigo ON pacientes(codigo_expediente);
CREATE INDEX IF NOT EXISTS idx_pacientes_ci ON pacientes(ci);
CREATE INDEX IF NOT EXISTS idx_pacientes_terapeuta ON pacientes(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_creador ON pacientes(creado_por_usuario_id);
CREATE INDEX IF NOT EXISTS idx_derivaciones_paciente ON derivaciones_pacientes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_derivaciones_destino ON derivaciones_pacientes(terapeuta_destino_id);
CREATE INDEX IF NOT EXISTS idx_derivaciones_origen ON derivaciones_pacientes(terapeuta_origen_id);
CREATE INDEX IF NOT EXISTS idx_paciente_tutor_paciente ON paciente_tutor(paciente_id);
CREATE INDEX IF NOT EXISTS idx_paciente_tutor_tutor ON paciente_tutor(tutor_id);
CREATE INDEX IF NOT EXISTS idx_triajes_usuario ON triajes_clinicos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_triajes_sesion ON triajes_clinicos(sesion_id);
CREATE INDEX IF NOT EXISTS idx_triajes_created ON triajes_clinicos(created_at);
CREATE INDEX IF NOT EXISTS idx_historias_paciente ON historias_clinicas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_historias_numero ON historias_clinicas(numero_expediente);
CREATE INDEX IF NOT EXISTS idx_anamnesis_historia ON anamnesis(historia_id);
CREATE INDEX IF NOT EXISTS idx_notas_historia ON notas_evolucion(historia_id);
CREATE INDEX IF NOT EXISTS idx_notas_paciente ON notas_evolucion(paciente_id);
CREATE INDEX IF NOT EXISTS idx_notas_terapeuta ON notas_evolucion(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_notas_fecha ON notas_evolucion(fecha_sesion);
CREATE INDEX IF NOT EXISTS idx_catalogo_codigo ON catalogo_diagnosticos(codigo);
CREATE INDEX IF NOT EXISTS idx_catalogo_categoria ON catalogo_diagnosticos(categoria);
CREATE INDEX IF NOT EXISTS idx_carpetas_paciente ON paciente_carpetas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_carpeta ON paciente_documentos(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_documentos_paciente ON paciente_documentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_planes_paciente ON planes_intervencion(paciente_id);
CREATE INDEX IF NOT EXISTS idx_planes_historia ON planes_intervencion(historia_id);
CREATE INDEX IF NOT EXISTS idx_metas_plan ON metas_terapeuticas(plan_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_meta ON seguimiento_metas_historial(meta_id);

-- Índices de velocidad para Agenda y Algoritmo Anti-Colisión (RN-01)
CREATE INDEX IF NOT EXISTS idx_citas_ambiente_rango ON citas(ambiente_id, fecha_hora_inicio, fecha_hora_fin);
CREATE INDEX IF NOT EXISTS idx_citas_terapeuta_rango ON citas(terapeuta_id, fecha_hora_inicio, fecha_hora_fin);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);
CREATE INDEX IF NOT EXISTS idx_citas_inicio ON citas(fecha_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sesiones_terapeuta ON whatsapp_sesiones(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sesiones_estado ON whatsapp_sesiones(estado);

-- Índices para Notificaciones Web Push y Centro de Alertas (Sprint 8)
CREATE INDEX IF NOT EXISTS idx_push_sub_usuario ON push_subscriptions(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones_sistema(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_leida ON notificaciones_sistema(leida);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notificaciones_sistema(created_at);

-- ============================================================================
-- SPRINT 9.5: DOCUMENTACIÓN LEGAL, FIRMA DIGITAL Y REPORTES WORD (MÓDULO I)
-- ============================================================================

-- Tabla de Recordatorios de Citas (Motor Persistente)
CREATE TABLE IF NOT EXISTS recordatorios_citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cita_id INTEGER NOT NULL,
  canal TEXT DEFAULT 'WHATSAPP_Y_PUSH',
  anticipacion_minutos INTEGER DEFAULT 30,
  fecha_programada_envio DATETIME NOT NULL,
  mensaje_personalizado TEXT,
  estado TEXT DEFAULT 'PENDIENTE',
  enviado_at DATETIME,
  error_mensaje TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE CASCADE
);

-- Tabla de Consentimientos Informados con Firma Táctil (HU-13 / RN-03)
CREATE TABLE IF NOT EXISTS consentimientos_informados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  tutor_id INTEGER NOT NULL,
  tipo_consentimiento TEXT NOT NULL CHECK (tipo_consentimiento IN (
    'EVALUACION_INICIAL',
    'TRATAMIENTO_CONTINUO',
    'INTERVENCION_NEUROCOGNITIVA',
    'TELEPSICOLOGIA',
    'APLICACION_PRUEBAS'
  )),
  titulo TEXT NOT NULL,
  contenido_clausulas TEXT NOT NULL,
  firma_digital_blob TEXT NOT NULL,
  firmado_por_nombre TEXT NOT NULL,
  firmado_por_ci TEXT NOT NULL,
  parentesco TEXT NOT NULL,
  ip_registro TEXT,
  user_agent TEXT,
  fecha_firma DATETIME DEFAULT CURRENT_TIMESTAMP,
  estado TEXT DEFAULT 'FIRMADO' CHECK (estado IN ('PENDIENTE', 'FIRMADO', 'REVOCADO')),
  motivo_revocacion TEXT,
  creado_por_usuario_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE RESTRICT,
  FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabla de Informes Clínicos Oficiales (.docx / PDF) (HU-14 / RF-I03 / RF-I07)
CREATE TABLE IF NOT EXISTS informes_clinicos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  historia_id INTEGER NOT NULL,
  terapeuta_id INTEGER NOT NULL,
  tipo_informe TEXT NOT NULL CHECK (tipo_informe IN (
    'EVALUACION_NEUROPSICOLOGICA',
    'INFORME_PSICOPEDAGOGICO',
    'VALORACION_GERONTOLOGICA',
    'EVOLUCION_CLINICA',
    'INFORME_ESCOLAR',
    'REPORTE_FAMILIAR_AVANCE'
  )),
  titulo TEXT NOT NULL,
  motivo_evaluacion TEXT,
  antecedentes_relevantes TEXT,
  baterias_administradas TEXT,
  resultados_cuantitativos TEXT,
  conclusiones_cualitativas TEXT,
  diagnostico_codigo TEXT,
  diagnostico_descripcion TEXT,
  recomendaciones_colegio TEXT,
  recomendaciones_familia TEXT,
  ruta_docx TEXT,
  ruta_archivo_firmado TEXT,
  entregable_familiar INTEGER DEFAULT 0 CHECK (entregable_familiar IN (0, 1)),
  estado TEXT DEFAULT 'EMITIDO' CHECK (estado IN ('BORRADOR', 'EMITIDO', 'FIRMADO', 'ARCHIVADO')),
  fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE RESTRICT,
  FOREIGN KEY (terapeuta_id) REFERENCES terapeutas(id) ON DELETE RESTRICT
);

-- Índices de velocidad para Módulo I y Recordatorios
CREATE INDEX IF NOT EXISTS idx_recordatorios_estado_fecha ON recordatorios_citas(estado, fecha_programada_envio);
CREATE INDEX IF NOT EXISTS idx_recordatorios_cita ON recordatorios_citas(cita_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_paciente ON consentimientos_informados(paciente_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_tutor ON consentimientos_informados(tutor_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_estado ON consentimientos_informados(estado);
CREATE INDEX IF NOT EXISTS idx_informes_paciente ON informes_clinicos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_informes_historia ON informes_clinicos(historia_id);
CREATE INDEX IF NOT EXISTS idx_informes_terapeuta ON informes_clinicos(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_informes_tipo ON informes_clinicos(tipo_informe);

-- ==============================================================================
-- SPRINT 10: MÓDULO J (PAGOS, COMPROBANTES Y CAJA) Y MÓDULO K (BATERÍAS Y RN-06)
-- ==============================================================================

-- 1. TABLA DE PAGOS Y CONCILIACIÓN DE CITAS (HU-15)
CREATE TABLE IF NOT EXISTS pagos_citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cita_id INTEGER REFERENCES citas(id) ON DELETE SET NULL,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tutor_id INTEGER REFERENCES tutores(id) ON DELETE SET NULL,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
  monto_bob REAL NOT NULL,
  metodo_pago TEXT DEFAULT 'QR_SIMPLE' CHECK (metodo_pago IN ('QR_SIMPLE', 'EFECTIVO', 'TRANSFERENCIA')),
  estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_REVISION', 'VERIFICADO', 'RECHAZADO')),
  comprobante_url TEXT,
  comprobante_tipo TEXT,
  numero_transaccion TEXT,
  observaciones TEXT,
  motivo_rechazo TEXT,
  verificado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_pago DATETIME,
  fecha_verificacion DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  servicio_nombre TEXT
);

CREATE INDEX IF NOT EXISTS idx_pagos_cita ON pagos_citas(cita_id);
CREATE INDEX IF NOT EXISTS idx_pagos_paciente ON pagos_citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_terapeuta ON pagos_citas(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos_citas(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos_citas(fecha_pago);

-- 2. TABLA DE ARQUEOS Y CIERRES DE CAJA (HU-15)
CREATE TABLE IF NOT EXISTS arqueos_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_cierre_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_caja DATE NOT NULL,
  saldo_inicial_bob REAL DEFAULT 0,
  total_efectivo_bob REAL DEFAULT 0,
  total_qr_bob REAL DEFAULT 0,
  total_general_bob REAL DEFAULT 0,
  cantidad_transacciones INTEGER DEFAULT 0,
  observaciones TEXT,
  estado TEXT DEFAULT 'CERRADO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
  cerrado_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_arqueos_fecha ON arqueos_caja(fecha_caja);

-- 3. TABLA DE INVENTARIO DE BATERÍAS NEUROPSICOMÉTRICAS (HU-16)
CREATE TABLE IF NOT EXISTS inventario_baterias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_patrimonial TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  editorial TEXT,
  area_evaluada TEXT,
  piezas_detalle TEXT,
  estado_conservacion TEXT DEFAULT 'BUENO' CHECK (estado_conservacion IN ('EXCELENTE', 'BUENO', 'REGULAR', 'REQUIERE_REPOSICION')),
  estado_disponibilidad TEXT DEFAULT 'DISPONIBLE' CHECK (estado_disponibilidad IN ('DISPONIBLE', 'EN_CONSULTA', 'EN_MANTENIMIENTO')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_baterias_disponibilidad ON inventario_baterias(estado_disponibilidad);
CREATE INDEX IF NOT EXISTS idx_baterias_codigo ON inventario_baterias(codigo_patrimonial);

-- 4. TABLA DE CONTROL DE PRÉSTAMOS Y BLOQUEO POR MORA RN-06 (HU-16)
CREATE TABLE IF NOT EXISTS prestamos_baterias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bateria_id INTEGER NOT NULL REFERENCES inventario_baterias(id) ON DELETE RESTRICT,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
  ambiente_id INTEGER REFERENCES ambientes(id) ON DELETE SET NULL,
  paciente_id INTEGER REFERENCES pacientes(id) ON DELETE SET NULL,
  fecha_retiro DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_devolucion_estimada DATETIME NOT NULL,
  fecha_devolucion_real DATETIME,
  estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'DEVUELTO', 'MORA')),
  observaciones_entrega TEXT,
  observaciones_recepcion TEXT,
  entregado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  recibido_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prestamos_bateria ON prestamos_baterias(bateria_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_terapeuta ON prestamos_baterias(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos_baterias(estado);

-- ==============================================================================
-- SPRINT 11: MÓDULO O (CONVENIOS Y ALIANZAS INSTITUCIONALES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS convenios_institucionales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_institucion TEXT NOT NULL,
  tipo_institucion TEXT NOT NULL,
  descripcion_convenio TEXT NOT NULL,
  beneficio_familias TEXT,
  imagen_url TEXT,
  telefono_contacto TEXT,
  email_contacto TEXT,
  direccion TEXT,
  sitio_web TEXT,
  destacado INTEGER DEFAULT 0 CHECK (destacado IN (0, 1)),
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  orden INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_convenios_activo ON convenios_institucionales(activo);
CREATE INDEX IF NOT EXISTS idx_convenios_tipo ON convenios_institucionales(tipo_institucion);
CREATE INDEX IF NOT EXISTS idx_convenios_destacado ON convenios_institucionales(destacado);

-- ==============================================================================
-- SPRINT 11: GLOSARIO CLÍNICO Y OPERATIVO INTERACTIVO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS glosario_terminos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  que_es TEXT NOT NULL,
  aplicacion TEXT NOT NULL,
  ejemplo TEXT NOT NULL,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_glosario_categoria ON glosario_terminos(category);
CREATE INDEX IF NOT EXISTS idx_glosario_title ON glosario_terminos(title);
-- ==============================================================================
-- SPRINT 12: CARTELERA Y GESTIÓN DE TALLERES, WEBINARS Y CURSOS CLÍNICOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS talleres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  tipo TEXT NOT NULL DEFAULT 'Presencial' CHECK (tipo IN ('Presencial', 'Virtual')),
  categoria TEXT NOT NULL DEFAULT 'Padres',
  terapeuta_principal_id INTEGER REFERENCES terapeutas(id) ON DELETE SET NULL,
  expositor_nombre TEXT,
  expositor_cargo TEXT,
  telefono_contacto TEXT,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL,
  lugar TEXT NOT NULL,
  direccion TEXT,
  arancel TEXT NOT NULL DEFAULT '50 Bs',
  arancel_detalle TEXT,
  cupos_totales INTEGER NOT NULL DEFAULT 15,
  cupos_ocupados INTEGER NOT NULL DEFAULT 0,
  dirigido_a TEXT,
  temas_json TEXT,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  destacado INTEGER DEFAULT 0 CHECK (destacado IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_talleres_activo ON talleres(activo);
CREATE INDEX IF NOT EXISTS idx_talleres_terapeuta ON talleres(terapeuta_principal_id);
CREATE INDEX IF NOT EXISTS idx_talleres_tipo ON talleres(tipo);

-- ==============================================================================
-- REPOSITORIO LIBRE DE MATERIALES Y RECURSOS CLÍNICOS TERAPÉUTICOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS materiales_carpetas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  color TEXT DEFAULT '#584294',
  icono TEXT DEFAULT 'folder',
  creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  es_publico INTEGER DEFAULT 1 CHECK (es_publico IN (0, 1)),
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_materiales_carpetas_activo ON materiales_carpetas(activo);

CREATE TABLE IF NOT EXISTS materiales_archivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carpeta_id INTEGER NOT NULL REFERENCES materiales_carpetas(id) ON DELETE CASCADE,
  nombre_original TEXT NOT NULL,
  nombre_almacenado TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  tamano_bytes INTEGER NOT NULL,
  categoria TEXT DEFAULT 'FICHA_TRABAJO',
  descripcion TEXT,
  es_publico INTEGER DEFAULT 1 CHECK (es_publico IN (0, 1)),
  subido_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  descargas_count INTEGER DEFAULT 0,
  activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_materiales_archivos_carpeta ON materiales_archivos(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_materiales_archivos_activo ON materiales_archivos(activo);


