-- ==============================================================================
-- SISTEMA WEB PWA "PSI APRENDE" (COCHABAMBA - BOLIVIA)
-- ESQUEMA BASE DE DATOS POSTGRESQL / SUPABASE (40 TABLAS CONSOLIDADAS + RLS)
-- Zona Horaria Institucional: America/La_Paz (UTC-4)
-- ==============================================================================

SET TIME ZONE 'America/La_Paz';

-- 1. ROLES DE USUARIO (RBAC)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. USUARIOS DEL SISTEMA
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  telefono TEXT,
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  ultimo_acceso TIMESTAMPTZ,
  fecha_desvinculacion TIMESTAMPTZ,
  motivo_desvinculacion TEXT,
  desvinculado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  firma_digital_blob TEXT,
  firma_actualizada_at TIMESTAMPTZ,
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INFRAESTRUCTURA DE LOS CONSULTORIOS FÍSICOS
CREATE TABLE IF NOT EXISTS ambientes (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descripcion TEXT,
  capacidad INTEGER DEFAULT 4,
  color_identificador TEXT DEFAULT '#2563eb',
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. ESPECIALIDADES CLÍNICAS ACREDITADAS
CREATE TABLE IF NOT EXISTS especialidades (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  color TEXT DEFAULT '#7c3aed',
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. SERVICIOS TERAPÉUTICOS Y ARANCELES (EN BOLIVIANOS - BOB)
CREATE TABLE IF NOT EXISTS servicios_aranceles (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  especialidad_id INTEGER REFERENCES especialidades(id) ON DELETE SET NULL,
  duracion_minutos INTEGER DEFAULT 60 CHECK (duracion_minutos > 0),
  margen_ventilacion_minutos INTEGER DEFAULT 10 CHECK (margen_ventilacion_minutos >= 0),
  arancel_bob DOUBLE PRECISION NOT NULL CHECK (arancel_bob >= 0),
  descripcion TEXT,
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. CONFIGURACIONES DEL SISTEMA
CREATE TABLE IF NOT EXISTS configuraciones_sistema (
  id SERIAL PRIMARY KEY,
  clave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'GENERAL',
  es_secreto SMALLINT DEFAULT 0 CHECK (es_secreto IN (0, 1)),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 7. BITÁCORA INALTERABLE DE AUDITORÍA Y SEGURIDAD
CREATE TABLE IF NOT EXISTS bitacora_auditoria (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre_snapshot TEXT,
  usuario_email_snapshot TEXT,
  rol_nombre_snapshot TEXT,
  accion TEXT NOT NULL,
  modulo TEXT NOT NULL,
  detalles TEXT,
  ip_origen TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. TERAPEUTAS Y ESPECIALISTAS CLÍNICOS
CREATE TABLE IF NOT EXISTS terapeutas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  registro_profesional TEXT UNIQUE NOT NULL,
  especialidad_id INTEGER REFERENCES especialidades(id) ON DELETE SET NULL,
  ambiente_preferido_id INTEGER REFERENCES ambientes(id) ON DELETE SET NULL,
  telefono TEXT,
  porcentaje_honorarios DOUBLE PRECISION DEFAULT 70.00 CHECK (porcentaje_honorarios >= 0 AND porcentaje_honorarios <= 100),
  color_agenda TEXT DEFAULT '#7c3aed',
  bio TEXT,
  turnos_atencion TEXT DEFAULT 'MAÑANA_TARDE',
  firma_digital_blob TEXT,
  firma_actualizada_at TIMESTAMPTZ,
  qr_cobro_url TEXT,
  banco_nombre TEXT,
  cuenta_numero TEXT,
  cuenta_titular TEXT,
  arancel_base_bob DOUBLE PRECISION DEFAULT 150.00,
  qr_fecha_vencimiento TEXT,
  foto_url TEXT,
  titulos_academicos TEXT,
  diplomados_certificaciones TEXT,
  experiencia_anios TEXT,
  enfoque_terapeutico TEXT,
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8.1 TARIFARIO DINÁMICO DE SERVICIOS POR ESPECIALISTA
CREATE TABLE IF NOT EXISTS terapeutas_servicios_precios (
  id SERIAL PRIMARY KEY,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE CASCADE,
  servicio_id INTEGER NOT NULL REFERENCES servicios_aranceles(id) ON DELETE CASCADE,
  arancel_bob DOUBLE PRECISION NOT NULL CHECK (arancel_bob >= 0),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(terapeuta_id, servicio_id)
);

-- 9. TUTORES LEGALES Y RED FAMILIAR
CREATE TABLE IF NOT EXISTS tutores (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  ci TEXT,
  parentesco TEXT DEFAULT 'MADRE',
  ocupacion TEXT,
  whatsapp TEXT NOT NULL,
  telefono_emergencia TEXT,
  direccion TEXT,
  email TEXT,
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. PACIENTES Y EXPEDIENTES CLÍNICOS
CREATE TABLE IF NOT EXISTS pacientes (
  id SERIAL PRIMARY KEY,
  codigo_expediente TEXT UNIQUE NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  ci TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  sexo TEXT NOT NULL CHECK (sexo IN ('M', 'F', 'OTRO')),
  colegio_ocupacion TEXT,
  antecedentes_medicos TEXT,
  antecedentes_perinatales TEXT,
  medicacion_actual TEXT,
  estado_clinico TEXT DEFAULT 'ACTIVO' CHECK (estado_clinico IN ('ACTIVO', 'EN_EVALUACION', 'ALTA', 'SUSPENDIDO')),
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  terapeuta_id INTEGER REFERENCES terapeutas(id) ON DELETE SET NULL,
  eliminado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_eliminacion TIMESTAMPTZ,
  motivo_baja TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. DERIVACIONES CLÍNICAS INTERDISCIPLINARIAS
CREATE TABLE IF NOT EXISTS derivaciones_pacientes (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  terapeuta_origen_id INTEGER REFERENCES terapeutas(id) ON DELETE SET NULL,
  terapeuta_destino_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
  usuario_responsable_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo TEXT NOT NULL,
  notas TEXT,
  estado TEXT DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'COMPLETADA', 'CANCELADA')),
  fecha_derivacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. RELACIÓN FAMILIAR: PACIENTE <-> TUTORES
CREATE TABLE IF NOT EXISTS paciente_tutor (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tutor_id INTEGER NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
  parentesco TEXT,
  es_principal SMALLINT DEFAULT 1 CHECK (es_principal IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(paciente_id, tutor_id)
);

-- 13. REGISTRO DE TRIAJES CLÍNICOS Y ORIENTACIÓN IA
CREATE TABLE IF NOT EXISTS triajes_clinicos (
  id SERIAL PRIMARY KEY,
  sesion_id TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo_consulta TEXT NOT NULL,
  motivo_anonimizado TEXT,
  area_sugerida TEXT NOT NULL,
  nivel_urgencia TEXT NOT NULL,
  motivo_sintetizado TEXT,
  preguntas_orientadoras TEXT,
  recomendacion_accion TEXT,
  es_crisis SMALLINT DEFAULT 0 CHECK (es_crisis IN (0, 1)),
  motor_utilizado TEXT,
  ip_origen TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. HISTORIAS CLÍNICAS DIGITALES UNIFICADAS
CREATE TABLE IF NOT EXISTS historias_clinicas (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
  numero_expediente TEXT NOT NULL UNIQUE,
  fecha_apertura DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date,
  estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'EN_EVALUACION', 'ALTA', 'SUSPENDIDO')),
  observaciones_ingreso TEXT,
  triaje_origen_id INTEGER REFERENCES triajes_clinicos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. EVALUACIÓN INICIAL / ANAMNESIS CLÍNICA
CREATE TABLE IF NOT EXISTS anamnesis (
  id SERIAL PRIMARY KEY,
  historia_id INTEGER NOT NULL UNIQUE REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  motivo_consulta TEXT NOT NULL,
  historia_problema_actual TEXT,
  antecedentes_perinatales TEXT,
  desarrollo_motor_lenguaje TEXT,
  antecedentes_medicos TEXT,
  antecedentes_familiares TEXT,
  dinamica_familiar_escolar TEXT,
  exploracion_cognitiva_conductual TEXT,
  impresion_diagnostica_inicial TEXT,
  evaluador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_evaluacion DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. NOTAS DE EVOLUCIÓN CONTINUA SOAP
CREATE TABLE IF NOT EXISTS notas_evolucion (
  id SERIAL PRIMARY KEY,
  historia_id INTEGER NOT NULL REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  numero_sesion INTEGER NOT NULL DEFAULT 1,
  fecha_sesion DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date,
  hora_inicio TEXT,
  hora_fin TEXT,
  ambiente_id INTEGER REFERENCES ambientes(id) ON DELETE SET NULL,
  subjetivo TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  analisis TEXT NOT NULL,
  plan TEXT NOT NULL,
  diagnostico_codigo TEXT,
  diagnostico_glosa TEXT,
  recomendaciones_hogar TEXT,
  asistido_por_ia SMALLINT DEFAULT 0 CHECK (asistido_por_ia IN (0, 1)),
  sellado SMALLINT DEFAULT 1 CHECK (sellado IN (0, 1)),
  firma_digital_snapshot TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 17. CATÁLOGO NOSOLÓGICO CLÍNICO CIE-11 / DSM-5
CREATE TABLE IF NOT EXISTS catalogo_diagnosticos (
  id SERIAL PRIMARY KEY,
  sistema TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descripcion TEXT,
  criterios_resumen TEXT,
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 18. CARPETAS DIGITALES DEL EXPEDIENTE
CREATE TABLE IF NOT EXISTS paciente_carpetas (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  es_sistema SMALLINT DEFAULT 0 CHECK (es_sistema IN (0, 1)),
  orden INTEGER DEFAULT 0,
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  motivo_baja TEXT,
  fecha_baja TIMESTAMPTZ,
  creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 19. DOCUMENTOS, ESTUDIOS EXTERNOS Y LABORATORIOS
CREATE TABLE IF NOT EXISTS paciente_documentos (
  id SERIAL PRIMARY KEY,
  carpeta_id INTEGER NOT NULL REFERENCES paciente_carpetas(id) ON DELETE RESTRICT,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  nombre_original TEXT NOT NULL,
  nombre_almacenado TEXT NOT NULL UNIQUE,
  tipo_mime TEXT NOT NULL,
  tamano_bytes INTEGER NOT NULL,
  categoria_clinica TEXT DEFAULT 'ESTUDIO_EXTERNO',
  descripcion TEXT,
  subido_por_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  motivo_anulacion TEXT,
  anulado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_anulacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 20. PLANES TERAPÉUTICOS INDIVIDUALIZADOS - PTI
CREATE TABLE IF NOT EXISTS planes_intervencion (
  id SERIAL PRIMARY KEY,
  historia_id INTEGER NOT NULL REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
  diagnostico_codigo TEXT,
  diagnostico_glosa TEXT,
  diagnostico_catalogo_id INTEGER REFERENCES catalogo_diagnosticos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  objetivo_general TEXT NOT NULL,
  periodicidad_meses INTEGER DEFAULT 3 CHECK (periodicidad_meses IN (1, 2, 3, 6, 12)),
  fecha_inicio DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date,
  fecha_revision DATE,
  recomendaciones_familia TEXT,
  estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'CUMPLIDO', 'DESCONTINUADO')),
  motivo_cierre TEXT,
  cerrado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_cierre TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 21. METAS TERAPÉUTICAS SMART
CREATE TABLE IF NOT EXISTS metas_terapeuticas (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES planes_intervencion(id) ON DELETE CASCADE,
  descripcion_meta TEXT NOT NULL,
  area_intervencion TEXT NOT NULL,
  criterio_exito TEXT NOT NULL,
  porcentaje_logro INTEGER DEFAULT 0 CHECK (porcentaje_logro IN (0, 25, 50, 75, 100)),
  estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'CONSOLIDADA')),
  pautas_hogar TEXT,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 22. TRAZABILIDAD Y SEGUIMIENTO HISTÓRICO DE METAS
CREATE TABLE IF NOT EXISTS seguimiento_metas_historial (
  id SERIAL PRIMARY KEY,
  meta_id INTEGER NOT NULL REFERENCES metas_terapeuticas(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES planes_intervencion(id) ON DELETE CASCADE,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
  porcentaje_anterior INTEGER NOT NULL,
  nuevo_porcentaje INTEGER NOT NULL,
  observaciones_clinicas TEXT,
  sesion_numero INTEGER,
  fecha_registro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 23. SEGUIMIENTO DE TUTORES EN EL HOGAR (TABLA CREADA DINÁMICAMENTE EN REPO)
CREATE TABLE IF NOT EXISTS tutor_seguimiento_hogar (
  id SERIAL PRIMARY KEY,
  meta_id INTEGER NOT NULL REFERENCES metas_terapeuticas(id) ON DELETE CASCADE,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tutor_id INTEGER NOT NULL REFERENCES tutores(id) ON DELETE CASCADE,
  nivel_respuesta TEXT NOT NULL,
  observacion_hogar TEXT,
  fecha_registro DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 24. AGENDA Y CITAS MÉDICAS
CREATE TABLE IF NOT EXISTS citas (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
  ambiente_id INTEGER NOT NULL REFERENCES ambientes(id) ON DELETE RESTRICT,
  servicio_id INTEGER REFERENCES servicios_aranceles(id) ON DELETE SET NULL,
  servicio_personalizado TEXT,
  arancel_personalizado DOUBLE PRECISION,
  fecha_hora_inicio TIMESTAMPTZ NOT NULL,
  fecha_hora_fin TIMESTAMPTZ NOT NULL,
  duracion_minutos INTEGER NOT NULL DEFAULT 45,
  estado TEXT NOT NULL DEFAULT 'PROGRAMADA' CHECK (estado IN ('PROGRAMADA', 'CONFIRMADA', 'EN_ATENCION', 'ATENDIDA', 'REPROGRAMADA', 'CANCELADA', 'AUSENTE')),
  motivo_consulta TEXT,
  motivo_cancelacion TEXT,
  notas_internas TEXT,
  reprogramada_de_cita_id INTEGER REFERENCES citas(id) ON DELETE SET NULL,
  creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  asistencia_registrada_at TIMESTAMPTZ,
  asistencia_registrada_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  recordatorio_24h_enviado SMALLINT DEFAULT 0 CHECK (recordatorio_24h_enviado IN (0, 1)),
  recordatorio_2h_enviado SMALLINT DEFAULT 0 CHECK (recordatorio_2h_enviado IN (0, 1)),
  recordatorio_24h_at TIMESTAMPTZ,
  recordatorio_2h_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 25. SESIONES DE WHATSAPP MULTI-INSTANCIA AISLADAS
CREATE TABLE IF NOT EXISTS whatsapp_sesiones (
  id SERIAL PRIMARY KEY,
  terapeuta_id INTEGER NOT NULL UNIQUE REFERENCES terapeutas(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'DESCONECTADO' CHECK (estado IN ('DESCONECTADO', 'INICIALIZANDO', 'ESPERANDO_QR', 'CONECTADO')),
  telefono_vinculado TEXT,
  nombre_dispositivo TEXT,
  ultimo_qr_generado_at TIMESTAMPTZ,
  ultimo_mensaje_at TIMESTAMPTZ,
  conectado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 26. SUSCRIPCIONES WEB PUSH
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 27. CENTRO DE ALERTAS Y NOTIFICACIONES IN-APP
CREATE TABLE IF NOT EXISTS notificaciones_sistema (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'RECORDATORIO',
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leida SMALLINT DEFAULT 0 CHECK (leida IN (0, 1)),
  link_url TEXT,
  cita_id INTEGER REFERENCES citas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 28. RECORDATORIOS DE CITAS (MOTOR PERSISTENTE)
CREATE TABLE IF NOT EXISTS recordatorios_citas (
  id SERIAL PRIMARY KEY,
  cita_id INTEGER NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  canal TEXT DEFAULT 'WHATSAPP_Y_PUSH' CHECK (canal IN ('WHATSAPP', 'PUSH', 'WHATSAPP_Y_PUSH')),
  anticipacion_minutos INTEGER DEFAULT 30,
  fecha_programada_envio TIMESTAMPTZ NOT NULL,
  mensaje_personalizado TEXT,
  estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'ENVIADO', 'CANCELADO', 'FALLIDO')),
  enviado_at TIMESTAMPTZ,
  error_mensaje TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 29. CONSENTIMIENTOS INFORMADOS CON FIRMA TÁCTIL
CREATE TABLE IF NOT EXISTS consentimientos_informados (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tutor_id INTEGER NOT NULL REFERENCES tutores(id) ON DELETE RESTRICT,
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
  fecha_firma TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  estado TEXT DEFAULT 'FIRMADO' CHECK (estado IN ('PENDIENTE', 'FIRMADO', 'REVOCADO')),
  motivo_revocacion TEXT,
  creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 30. INFORMES CLÍNICOS OFICIALES (.docx / PDF)
CREATE TABLE IF NOT EXISTS informes_clinicos (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  historia_id INTEGER NOT NULL REFERENCES historias_clinicas(id) ON DELETE RESTRICT,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
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
  entregable_familiar SMALLINT DEFAULT 0 CHECK (entregable_familiar IN (0, 1)),
  estado TEXT DEFAULT 'EMITIDO' CHECK (estado IN ('BORRADOR', 'EMITIDO', 'FIRMADO', 'ARCHIVADO')),
  fecha_emision TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 31. PAGOS Y CONCILIACIÓN DE CITAS
CREATE TABLE IF NOT EXISTS pagos_citas (
  id SERIAL PRIMARY KEY,
  cita_id INTEGER REFERENCES citas(id) ON DELETE SET NULL,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tutor_id INTEGER REFERENCES tutores(id) ON DELETE SET NULL,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
  monto_bob DOUBLE PRECISION NOT NULL,
  metodo_pago TEXT DEFAULT 'QR_SIMPLE' CHECK (metodo_pago IN ('QR_SIMPLE', 'EFECTIVO', 'TRANSFERENCIA')),
  estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_REVISION', 'VERIFICADO', 'RECHAZADO')),
  comprobante_url TEXT,
  comprobante_tipo TEXT,
  numero_transaccion TEXT,
  observaciones TEXT,
  motivo_rechazo TEXT,
  verificado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_pago TIMESTAMPTZ,
  fecha_verificacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  servicio_nombre TEXT
);

-- 32. ARQUEOS Y CIERRES DE CAJA
CREATE TABLE IF NOT EXISTS arqueos_caja (
  id SERIAL PRIMARY KEY,
  usuario_cierre_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_caja DATE NOT NULL,
  saldo_inicial_bob DOUBLE PRECISION DEFAULT 0,
  total_efectivo_bob DOUBLE PRECISION DEFAULT 0,
  total_qr_bob DOUBLE PRECISION DEFAULT 0,
  total_general_bob DOUBLE PRECISION DEFAULT 0,
  cantidad_transacciones INTEGER DEFAULT 0,
  observaciones TEXT,
  estado TEXT DEFAULT 'CERRADO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
  cerrado_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 33. INVENTARIO DE BATERÍAS NEUROPSICOMÉTRICAS
CREATE TABLE IF NOT EXISTS inventario_baterias (
  id SERIAL PRIMARY KEY,
  codigo_patrimonial TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  editorial TEXT,
  area_evaluada TEXT,
  piezas_detalle TEXT,
  estado_conservacion TEXT DEFAULT 'BUENO' CHECK (estado_conservacion IN ('EXCELENTE', 'BUENO', 'REGULAR', 'REQUIERE_REPOSICION')),
  estado_disponibilidad TEXT DEFAULT 'DISPONIBLE' CHECK (estado_disponibilidad IN ('DISPONIBLE', 'EN_CONSULTA', 'EN_MANTENIMIENTO')),
  imagen_url TEXT,
  documento_referencia_url TEXT,
  ubicacion TEXT DEFAULT 'Gabinete General',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 34. CONTROL DE PRÉSTAMOS Y BLOQUEO POR MORA
CREATE TABLE IF NOT EXISTS prestamos_baterias (
  id SERIAL PRIMARY KEY,
  bateria_id INTEGER NOT NULL REFERENCES inventario_baterias(id) ON DELETE RESTRICT,
  terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
  ambiente_id INTEGER REFERENCES ambientes(id) ON DELETE SET NULL,
  paciente_id INTEGER REFERENCES pacientes(id) ON DELETE SET NULL,
  fecha_retiro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  fecha_devolucion_estimada TIMESTAMPTZ NOT NULL,
  fecha_devolucion_real TIMESTAMPTZ,
  estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'DEVUELTO', 'MORA')),
  observaciones_entrega TEXT,
  observaciones_recepcion TEXT,
  entregado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  recibido_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 35. CONVENIOS Y ALIANZAS INSTITUCIONALES
CREATE TABLE IF NOT EXISTS convenios_institucionales (
  id SERIAL PRIMARY KEY,
  nombre_institucion TEXT NOT NULL,
  tipo_institucion TEXT NOT NULL,
  descripcion_convenio TEXT NOT NULL,
  beneficio_familias TEXT,
  imagen_url TEXT,
  telefono_contacto TEXT,
  email_contacto TEXT,
  direccion TEXT,
  sitio_web TEXT,
  destacado SMALLINT DEFAULT 0 CHECK (destacado IN (0, 1)),
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 36. GLOSARIO CLÍNICO Y OPERATIVO INTERACTIVO
CREATE TABLE IF NOT EXISTS glosario_terminos (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  que_es TEXT NOT NULL,
  aplicacion TEXT NOT NULL,
  ejemplo TEXT NOT NULL,
  autor TEXT DEFAULT 'Equipo PSI Aprende',
  orden INTEGER DEFAULT 0,
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 37. TALLERES, WEBINARS Y CURSOS CLÍNICOS
CREATE TABLE IF NOT EXISTS talleres (
  id SERIAL PRIMARY KEY,
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
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  destacado SMALLINT DEFAULT 0 CHECK (destacado IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 38. CARPETAS DE MATERIALES CLÍNICOS
CREATE TABLE IF NOT EXISTS materiales_carpetas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  color TEXT DEFAULT '#584294',
  icono TEXT DEFAULT 'folder',
  creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  es_publico SMALLINT DEFAULT 1 CHECK (es_publico IN (0, 1)),
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 39. ARCHIVOS DE MATERIALES CLÍNICOS
CREATE TABLE IF NOT EXISTS materiales_archivos (
  id SERIAL PRIMARY KEY,
  carpeta_id INTEGER NOT NULL REFERENCES materiales_carpetas(id) ON DELETE CASCADE,
  nombre_original TEXT NOT NULL,
  nombre_almacenado TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  tamano_bytes INTEGER NOT NULL,
  categoria TEXT DEFAULT 'FICHA_TRABAJO',
  descripcion TEXT,
  es_publico SMALLINT DEFAULT 1 CHECK (es_publico IN (0, 1)),
  subido_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  descargas_count INTEGER DEFAULT 0,
  activo SMALLINT DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- ÍNDICES DE RENDIMIENTO E INTEGRIDAD CASE-INSENSITIVE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_config_clave ON configuraciones_sistema(LOWER(clave));
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON bitacora_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_terapeutas_usuario ON terapeutas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_terapeutas_especialidad ON terapeutas(especialidad_id);
CREATE INDEX IF NOT EXISTS idx_tutores_ci ON tutores(LOWER(ci));
CREATE INDEX IF NOT EXISTS idx_tutores_whatsapp ON tutores(whatsapp);
CREATE INDEX IF NOT EXISTS idx_pacientes_codigo ON pacientes(LOWER(codigo_expediente));
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
CREATE INDEX IF NOT EXISTS idx_catalogo_codigo ON catalogo_diagnosticos(LOWER(codigo));
CREATE INDEX IF NOT EXISTS idx_catalogo_categoria ON catalogo_diagnosticos(categoria);
CREATE INDEX IF NOT EXISTS idx_carpetas_paciente ON paciente_carpetas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_carpeta ON paciente_documentos(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_documentos_paciente ON paciente_documentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_planes_paciente ON planes_intervencion(paciente_id);
CREATE INDEX IF NOT EXISTS idx_planes_historia ON planes_intervencion(historia_id);
CREATE INDEX IF NOT EXISTS idx_metas_plan ON metas_terapeuticas(plan_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_meta ON seguimiento_metas_historial(meta_id);
CREATE INDEX IF NOT EXISTS idx_tutor_seg_meta ON tutor_seguimiento_hogar(meta_id);
CREATE INDEX IF NOT EXISTS idx_tutor_seg_paciente ON tutor_seguimiento_hogar(paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_ambiente_rango ON citas(ambiente_id, fecha_hora_inicio, fecha_hora_fin);
CREATE INDEX IF NOT EXISTS idx_citas_terapeuta_rango ON citas(terapeuta_id, fecha_hora_inicio, fecha_hora_fin);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);
CREATE INDEX IF NOT EXISTS idx_citas_inicio ON citas(fecha_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sesiones_terapeuta ON whatsapp_sesiones(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sesiones_estado ON whatsapp_sesiones(estado);
CREATE INDEX IF NOT EXISTS idx_push_sub_usuario ON push_subscriptions(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones_sistema(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_leida ON notificaciones_sistema(leida);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notificaciones_sistema(created_at);
CREATE INDEX IF NOT EXISTS idx_recordatorios_estado_fecha ON recordatorios_citas(estado, fecha_programada_envio);
CREATE INDEX IF NOT EXISTS idx_recordatorios_cita ON recordatorios_citas(cita_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_paciente ON consentimientos_informados(paciente_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_tutor ON consentimientos_informados(tutor_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_estado ON consentimientos_informados(estado);
CREATE INDEX IF NOT EXISTS idx_informes_paciente ON informes_clinicos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_informes_historia ON informes_clinicos(historia_id);
CREATE INDEX IF NOT EXISTS idx_informes_terapeuta ON informes_clinicos(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_informes_tipo ON informes_clinicos(tipo_informe);
CREATE INDEX IF NOT EXISTS idx_pagos_cita ON pagos_citas(cita_id);
CREATE INDEX IF NOT EXISTS idx_pagos_paciente ON pagos_citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_terapeuta ON pagos_citas(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos_citas(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos_citas(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_arqueos_fecha ON arqueos_caja(fecha_caja);
CREATE INDEX IF NOT EXISTS idx_baterias_disponibilidad ON inventario_baterias(estado_disponibilidad);
CREATE INDEX IF NOT EXISTS idx_baterias_codigo ON inventario_baterias(codigo_patrimonial);
CREATE INDEX IF NOT EXISTS idx_prestamos_bateria ON prestamos_baterias(bateria_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_terapeuta ON prestamos_baterias(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos_baterias(estado);
CREATE INDEX IF NOT EXISTS idx_convenios_activo ON convenios_institucionales(activo);
CREATE INDEX IF NOT EXISTS idx_convenios_tipo ON convenios_institucionales(tipo_institucion);
CREATE INDEX IF NOT EXISTS idx_convenios_destacado ON convenios_institucionales(destacado);
CREATE INDEX IF NOT EXISTS idx_glosario_categoria ON glosario_terminos(category);
CREATE INDEX IF NOT EXISTS idx_glosario_title ON glosario_terminos(title);
CREATE INDEX IF NOT EXISTS idx_glosario_activo ON glosario_terminos(activo);
CREATE INDEX IF NOT EXISTS idx_talleres_activo ON talleres(activo);
CREATE INDEX IF NOT EXISTS idx_talleres_terapeuta ON talleres(terapeuta_principal_id);
CREATE INDEX IF NOT EXISTS idx_talleres_tipo ON talleres(tipo);
CREATE INDEX IF NOT EXISTS idx_materiales_carpetas_activo ON materiales_carpetas(activo);
CREATE INDEX IF NOT EXISTS idx_materiales_archivos_carpeta ON materiales_archivos(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_materiales_archivos_activo ON materiales_archivos(activo);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) ACTIVADO EN TODAS LAS TABLAS PARA SUPABASE
-- Bloquea acceso directo desde PostgREST/anon; el backend Express usa conexión PostgreSQL privilegiada.
-- ==============================================================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios_aranceles ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapeutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapeutas_servicios_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE derivaciones_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE paciente_tutor ENABLE ROW LEVEL SECURITY;
ALTER TABLE triajes_clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historias_clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_evolucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE paciente_carpetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE paciente_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes_intervencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_terapeuticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguimiento_metas_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_seguimiento_hogar ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordatorios_citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE consentimientos_informados ENABLE ROW LEVEL SECURITY;
ALTER TABLE informes_clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arqueos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_baterias ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos_baterias ENABLE ROW LEVEL SECURITY;
ALTER TABLE convenios_institucionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE glosario_terminos ENABLE ROW LEVEL SECURITY;
ALTER TABLE talleres ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales_carpetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales_archivos ENABLE ROW LEVEL SECURITY;
