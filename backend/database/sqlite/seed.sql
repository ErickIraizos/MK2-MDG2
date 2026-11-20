-- ==============================================================================
-- SISTEMA WEB PWA "PSI APRENDE"
-- DATOS INICIALES (SEED.SQL)
-- ==============================================================================

-- 1. INSERTAR ROLES DEL SISTEMA
INSERT OR IGNORE INTO roles (id, nombre, descripcion) VALUES
  (1, 'ADMIN', 'Dirección General y Administración total del Centro PSI Aprende'),
  (2, 'TERAPEUTA', 'Especialistas clínicos (Neuropsicología, Psicopedagogía, etc.)'),
  (3, 'RECEPCION', 'Admisión de pacientes, asignación de salas y cobranza en caja'),
  (4, 'TUTOR', 'Padres de familia, tutores legales y pacientes adultos');

-- 2. INSERTAR USUARIOS INICIALES (Contraseña por defecto: Password123!)
-- Hash bcrypt generado para 'Password123!' con salt de 10 rounds:
-- $2a$10$/jm8fcwejc8moUG3J4fFdu2uIdojNUbgt7fO6uKH2ncLdIhloxkT2
INSERT OR IGNORE INTO usuarios (id, nombre_completo, email, password_hash, rol_id, telefono) VALUES
  (1, 'Mgr. Grisel Aguilar Apaza', 'admin@psi-aprende.com', '$2a$10$/jm8fcwejc8moUG3J4fFdu2uIdojNUbgt7fO6uKH2ncLdIhloxkT2', 1, '+591 70000001'),
  (2, 'Lic. Claudia Morales Soto', 'terapeuta@psi-aprende.com', '$2a$10$/jm8fcwejc8moUG3J4fFdu2uIdojNUbgt7fO6uKH2ncLdIhloxkT2', 2, '+591 70000002'),
  (3, 'Mariela Rocha Guzmán', 'recepcion@psi-aprende.com', '$2a$10$/jm8fcwejc8moUG3J4fFdu2uIdojNUbgt7fO6uKH2ncLdIhloxkT2', 3, '+591 70000003'),
  (4, 'Carlos Fuentes Mendoza', 'tutor@psi-aprende.com', '$2a$10$/jm8fcwejc8moUG3J4fFdu2uIdojNUbgt7fO6uKH2ncLdIhloxkT2', 4, '+591 70000004'),
  (5, 'Lic. Valeria Bustamante Ríos', 'valeria.bustamante@psi-aprende.com', '$2a$10$/jm8fcwejc8moUG3J4fFdu2uIdojNUbgt7fO6uKH2ncLdIhloxkT2', 2, '+591 70000005'),
  (6, 'Lic. Rodrigo Méndez Salinas', 'rodrigo.mendez@psi-aprende.com', '$2a$10$/jm8fcwejc8moUG3J4fFdu2uIdojNUbgt7fO6uKH2ncLdIhloxkT2', 2, '+591 70000006'),
  (7, 'Lic. Andrea Torrico Navia', 'andrea.torrico@psi-aprende.com', '$2a$10$/jm8fcwejc8moUG3J4fFdu2uIdojNUbgt7fO6uKH2ncLdIhloxkT2', 2, '+591 70000007');

-- 3. INSERTAR LOS 3 AMBIENTES / CONSULTORIOS FÍSICOS
INSERT OR IGNORE INTO ambientes (id, codigo, nombre, tipo, descripcion, capacidad, color_identificador) VALUES
  (1, 'CONS-01', 'Consultorio 1 - Infantil / Neuropsicología y Psicopedagogía', 'INFANTIL', 'Equipado con materiales sensoriales, mesa de estimulación y baterías CUMANES / WISC-V', 4, '#0284c7'),
  (2, 'CONS-02', 'Consultorio 2 - Evaluación Integral y Terapia Conductual', 'INTEGRAL_CONDUCTUAL', 'Ambiente adaptado para evaluación conductual, dinámicas familiares y adolescentes', 5, '#7c3aed'),
  (3, 'CONS-03', 'Consultorio 3 - Adultos y Psicogerontología (Independiente)', 'ADULTOS_GERONTOLOGIA', 'Consultorio privado y tranquilo diseñado especialmente para adultos y adultos mayores (Horizontes Plateados)', 4, '#d97706');

-- 4. INSERTAR ESPECIALIDADES CLÍNICAS
INSERT OR IGNORE INTO especialidades (id, nombre, descripcion, color) VALUES
  (1, 'Neuropsicología Infantil', 'Diagnóstico e intervención en TDAH, TEA y madurez neurocognitiva', '#7c3aed'),
  (2, 'Psicopedagogía', 'Dificultades específicas de aprendizaje: dislexia, discalculia y disgrafía', '#0284c7'),
  (3, 'Psicogerontología y Adulto Mayor', 'Evaluación VGI, estimulación cognitiva y prevención de deterioro neurocognitivo', '#d97706'),
  (4, 'Psicología Clínica y Conductual', 'Psicoterapia individual, manejo de ansiedad, autoestima y orientación familiar', '#10b981'),
  (5, 'Terapia del Lenguaje y Fonoaudiología', 'Estimulación del habla, articulación y fluidez verbal', '#f59e0b');

-- 5. SERVICIOS TERAPÉUTICOS Y ARANCELES OFICIALES (BOB)
INSERT OR IGNORE INTO servicios_aranceles (id, nombre, especialidad_id, duracion_minutos, margen_ventilacion_minutos, arancel_bob, descripcion) VALUES
  (1, 'Evaluación Neuropsicológica Integral', 1, 90, 10, 220.00, 'Aplicación de pruebas estandarizadas y perfil neurocognitivo'),
  (2, 'Sesión de Intervención Psicopedagógica', 2, 60, 10, 150.00, 'Estimulación de lectura, escritura y habilidades lógico-matemáticas'),
  (3, 'Consulta de Psicoterapia Adulto / Familiar', 4, 60, 10, 160.00, 'Sesión clínica de modificación conductual y apoyo emocional'),
  (4, 'Valoración Gerontológica Integral (VGI)', 3, 90, 10, 200.00, 'Evaluación de funciones ejecutivas y memoria para el adulto mayor'),
  (5, 'Sesión de Estimulación Neurocognitiva', 1, 45, 10, 130.00, 'Entrenamiento atencional y control inhibitorio');

-- 6. PARÁMETROS DEL SISTEMA Y GESTIÓN EN CALIENTE DE IA
INSERT OR IGNORE INTO configuraciones_sistema (clave, valor, descripcion, categoria, es_secreto) VALUES
  ('INSTITUCION_NOMBRE', 'Centro Psicopedagógico y de Atención Psicológica "PSI Aprende"', 'Nombre oficial de la institución', 'INSTITUCIONAL', 0),
  ('INSTITUCION_DIRECCION', 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba, Bolivia', 'Dirección física de los consultorios', 'INSTITUCIONAL', 0),
  ('INSTITUCION_TELEFONO', '+591 4 4521234', 'Teléfono fijo de recepción', 'INSTITUCIONAL', 0),
  ('INSTITUCION_WHATSAPP', '+591 71234567', 'Número oficial de WhatsApp para mensajes', 'INSTITUCIONAL', 0),
  ('INSTITUCION_MISION', 'Brindar evaluación diagnóstica neurocognitiva y psicopedagógica integral, basada en evidencia científica y calidez humana, potenciando el aprendizaje y bienestar emocional de cada paciente y su familia.', 'Misión institucional', 'INSTITUCIONAL', 0),
  ('INSTITUCION_VISION', 'Ser el centro psicopedagógico y neurocognitivo de mayor prestigio y referencia en Cochabamba y Bolivia, reconocido por su rigor ético, metodologías personalizadas y articulación con familias y colegios.', 'Visión institucional', 'INSTITUCIONAL', 0),
  ('INSTITUCION_METAS', '1. Detección temprana de dificultades del aprendizaje y neurodesarrollo. 2. Tratamientos individualizados con metodología SOAP y metas SMART. 3. Respaldo ético con 100% de terapeutas colegiados y secreto profesional bajo Ley 3131.', 'Metas y objetivos institucionales', 'INSTITUCIONAL', 0),
  ('INSTITUCION_DIRECTORA', 'Mgr. Grisel Aguilar Apaza', 'Nombre de la Directora General', 'INSTITUCIONAL', 0),
  ('INSTITUCION_HORARIO', 'Lunes a Viernes: 08:30 a 12:30 y 14:30 a 18:30 · Sábados: 09:00 a 13:00', 'Horarios de atención', 'INSTITUCIONAL', 0),
  ('INSTITUCION_GOOGLE_MAPS_URL', 'https://maps.google.com/?q=-17.396611,-66.150722', 'Enlace directo de Google Maps', 'INSTITUCIONAL', 0),

  ('GROQ_API_KEY', 'gsk_demo_dummy_key_psi_aprende_2026', 'Clave API activa para el Asistente MindBot IA', 'IA', 1),
  ('GROQ_MODEL_PRIMARY', 'openai/gpt-oss-120b', 'Modelo primario para triaje inteligente', 'IA', 0),
  ('GROQ_MODEL_FALLBACK', 'openai/gpt-oss-20b', 'Modelo secundario de respaldo en caso de saturación', 'IA', 0),
  ('MONEDA_SIMBOLO', 'Bs.', 'Símbolo monetario oficial (Bolivianos)', 'FINANZAS', 0),
  ('VENTILACION_SALAS_MINUTOS', '10', 'Margen preventivo obligatorio entre sesiones en salas', 'GENERAL', 0);

-- 7. INSERTAR LOS 5 TERAPEUTAS / ESPECIALISTAS CLÍNICOS OFICIALES (MÓDULO C)
INSERT OR IGNORE INTO terapeutas (id, usuario_id, nombres, apellidos, registro_profesional, especialidad_id, ambiente_preferido_id, telefono, porcentaje_honorarios, color_agenda, bio, turnos_atencion) VALUES
  (1, 1, 'Grisel', 'Aguilar Apaza', 'CPB-1402', 1, 1, '+591 70000001', 80.00, '#7c3aed', 'Directora General. Máster en Neuropsicología Clínica e intervención temprana en neurodesarrollo.', 'MAÑANA_TARDE'),
  (2, 2, 'Claudia', 'Morales Soto', 'CPB-2150', 2, 1, '+591 70000002', 70.00, '#0284c7', 'Especialista en Psicopedagogía, reeducación de lectura, escritura y discalculia infantil.', 'MAÑANA_TARDE'),
  (3, 5, 'Valeria', 'Bustamante Ríos', 'CPB-3318', 3, 3, '+591 70000005', 70.00, '#d97706', 'Psicogerontóloga clínica. Coordinadora del programa preventivo Horizontes Plateados.', 'TARDE'),
  (4, 6, 'Rodrigo', 'Méndez Salinas', 'CPB-1944', 4, 2, '+591 70000006', 70.00, '#10b981', 'Psicólogo Clínico cognitivo-conductual. Enfoque en adolescentes, adultos y dinámica familiar.', 'MAÑANA_TARDE'),
  (5, 7, 'Andrea', 'Torrico Navia', 'CPB-2891', 5, 1, '+591 70000007', 70.00, '#f59e0b', 'Fonoaudióloga y Terapeuta de Lenguaje. Estimulación verbal y rehabilitación miofuncional.', 'MAÑANA');

-- 8. INSERTAR TUTORES LEGALES Y RED FAMILIAR INICIAL (MÓDULO B)
INSERT OR IGNORE INTO tutores (id, usuario_id, nombres, apellidos, ci, parentesco, ocupacion, whatsapp, telefono_emergencia, direccion, email) VALUES
  (1, 4, 'Carlos', 'Fuentes Mendoza', '5432109 CB', 'PADRE', 'Ingeniero Civil', '+591 70000004', '+591 4 4455667', 'Av. América Este #1234, Cochabamba', 'tutor@psi-aprende.com'),
  (2, NULL, 'Sofía', 'Guzmán de Valenzuela', '4567891 CB', 'MADRE', 'Arquitecta', '+591 72233445', '+591 4 4233445', 'Calle Tarija esq. Portales, Cochabamba', 'sofia.guzman@gmail.com'),
  (3, NULL, 'Roberto', 'Valenzuela Pérez', '3456789 CB', 'PADRE', 'Empresario', '+591 72233446', '+591 4 4233445', 'Calle Tarija esq. Portales, Cochabamba', 'roberto.valenzuela@gmail.com'),
  (4, NULL, 'Elena', 'Bustamante Morales', '2345678 CB', 'HIJA', 'Docente Universitaria', '+591 73344556', '+591 4 4788990', 'Av. Melchor Pérez #450, Cochabamba', 'elena.bustamante@gmail.com');

-- 9. INSERTAR EXPEDIENTES DE PACIENTES INICIALES (MÓDULO B)
INSERT OR IGNORE INTO pacientes (id, codigo_expediente, nombres, apellidos, ci, fecha_nacimiento, sexo, colegio_ocupacion, antecedentes_medicos, antecedentes_perinatales, medicacion_actual, estado_clinico, creado_por_usuario_id, terapeuta_id) VALUES
  (1, 'PSI-A-0001', 'Mateo', 'Fuentes Rocha', '9876543 CB', '2018-05-14', 'M', 'Colegio Alemán Santa María (3ro Primaria)', 'Alergia a la penicilina', 'Parto a término sin complicaciones neonatales. Hitos motores dentro del rango esperado.', 'Ninguna', 'ACTIVO', 1, 1),
  (2, 'PSI-A-0002', 'Luciana', 'Valenzuela Guzmán', '1029384 CB', '2019-11-20', 'F', 'Colegio Calvert (1ro Primaria)', 'Sin antecedentes patológicos relevantes', 'Nacimiento pretérmino (36 semanas). Incubadora 3 días por ictericia leve.', 'Complejo vitamínico infantil', 'ACTIVO', 2, 2),
  (3, 'PSI-A-0003', 'Leonardo', 'Valenzuela Guzmán', '8765432 CB', '2016-08-10', 'M', 'Colegio Calvert (5to Primaria)', 'Miopía corregida con lentes', 'Embarazo normal, parto por cesárea programada.', 'Ninguna', 'ACTIVO', 2, 2),
  (4, 'PSI-A-0004', 'Gonzalo', 'Bustamante Morales', '897654 CB', '1952-03-12', 'M', 'Jubilado (Ex-Bancario)', 'Hipertensión arterial controlada, artrosis leve', 'No aplica (Adulto Mayor)', 'Losartán 50mg/día', 'ACTIVO', 1, 3);

-- 10. VINCULAR PACIENTES CON SU RED FAMILIAR (HERMANOS Y TUTORES)
INSERT OR IGNORE INTO paciente_tutor (paciente_id, tutor_id, parentesco, es_principal) VALUES
  (1, 1, 'PADRE', 1), -- Mateo con su padre Carlos Fuentes
  (2, 2, 'MADRE', 1), -- Luciana con su madre Sofía Guzmán (Principal)
  (2, 3, 'PADRE', 0), -- Luciana con su padre Roberto Valenzuela (Secundario)
  (3, 2, 'MADRE', 1), -- Leonardo (hermano de Luciana) con su madre Sofía Guzmán (Unificación familiar)
  (3, 3, 'PADRE', 0), -- Leonardo con su padre Roberto Valenzuela
  (4, 4, 'HIJA', 1);  -- Don Gonzalo (Adulto Mayor) con su hija y cuidadora Elena Bustamante

-- 11. DERIVACIONES CLÍNICAS INICIALES (INTERCONSULTA)
INSERT OR IGNORE INTO derivaciones_pacientes (id, paciente_id, terapeuta_origen_id, terapeuta_destino_id, usuario_responsable_id, motivo, notas, estado) VALUES
  (1, 2, 2, 5, 2, 'Evaluación y estimulación fonoaudiológica complementaria por dislalia funcional', 'La paciente presenta avances psicopedagógicos pero requiere valoración en articulación de fonemas /r/ y /s/.', 'ACTIVA');

-- 12. HISTORIAS CLÍNICAS DIGITALES INICIALES (MÓDULO E - SPRINT 4)
INSERT OR IGNORE INTO historias_clinicas (id, paciente_id, numero_expediente, fecha_apertura, estado, observaciones_ingreso) VALUES
  (1, 1, 'PSI-A-0001', '2026-08-15', 'ACTIVO', 'Apertura formal de expediente por derivación escolar por sospecha de dificultades atencionales.'),
  (2, 2, 'PSI-A-0002', '2026-09-01', 'ACTIVO', 'Expediente clínico integral para intervención psicopedagógica y fonoaudiológica.'),
  (3, 3, 'PSI-A-0003', '2026-09-10', 'ACTIVO', 'Hermano de paciente PSI-A-0002. Valoración de habilidades lectoras y rendimiento académico.'),
  (4, 4, 'PSI-A-0004', '2026-07-20', 'ACTIVO', 'Ingreso al programa preventivo de estimulación cognitiva para el adulto mayor "Horizontes Plateados".');

-- 13. EVALUACIÓN INICIAL / ANAMNESIS CLÍNICA (MÓDULO E - SPRINT 4)
INSERT OR IGNORE INTO anamnesis (id, historia_id, motivo_consulta, historia_problema_actual, antecedentes_perinatales, desarrollo_motor_lenguaje, antecedentes_medicos, antecedentes_familiares, dinamica_familiar_escolar, exploracion_cognitiva_conductual, impresion_diagnostica_inicial, evaluador_id, fecha_evaluacion) VALUES
  (1, 1, 
   'Dificultades notorias en la atención sostenida, inquietud motora frecuente en el aula y lentitud para finalizar tareas escritas prolongadas.',
   'El padre refiere que desde el inicio del 2do de Primaria el niño presenta dispersión frecuente, pierde útiles escolares y requiere supervisión constante para culminar deberes. No presenta agresividad.',
   'Embarazo controlado a término (39 semanas). Parto eutócico sin hipoxia ni complicaciones perinatales.',
   'Sedestación a los 6 meses, marcha a los 12 meses. Primeras palabras a los 11 meses con frases complejas a los 2 años. Control de esfínteres a los 2 años y medio.',
   'Alergia a la penicilina diagnosticada a los 4 años. Cuadros respiratorios estacionales leves.',
   'Padre con reporte escolar histórico de dispersión en la infancia. Sin antecedentes psiquiátricos graves.',
   'Familia nuclear monoparental estable. El padre mantiene estrecha comunicación con el colegio. En el aula se sienta en primera fila.',
   'Alerta, orientado en tiempo y espacio. Contacto visual adecuado, discurso coherente. Durante tareas monótonas incrementa el movimiento de extremidades inferiores.',
   'Indicadores clínicos neurocognitivos sugerentes de TDAH con predominio atencional e hiperactividad leve (CIE-11: 6A05 / DSM-5: 314.01).',
   1, '2026-08-18'),

  (2, 2,
   'Retraso en la adquisición de la lectoescritura, inversión de grafemas y confusión fonética entre /b/ y /d/.',
   'La madre indica que la docente de 1ro de Primaria detectó que Luciana se fatiga rápidamente al copiar de la pizarra y muestra resistencia a la lectura en voz alta.',
   'Nacimiento pretérmino (36 semanas). Peso 2.450g. Permaneció en fototerapia 3 días por ictericia neonatal.',
   'Desarrollo psicomotor general acorde a su edad. Hitos del lenguaje con ligera dificultad en discriminación auditiva de fonemas líquidos.',
   'Sin alergias ni antecedentes médicos crónicos conocidos.',
   'Sin antecedentes familiares conocidos de trastornos del neurodesarrollo.',
   'Ambiente familiar afectuoso y contenedor. Ambos progenitores participan activamente en el seguimiento.',
   'Cooperativa, afectuosa y atenta. Muestra frustración transitoria ante actividades de lectura forzada.',
   'Perfil sugerente de Trastorno Específico del Aprendizaje con dificultades en la lectura y dislalia funcional (CIE-11: 6A03 / DSM-5: 315.00).',
   2, '2026-09-03'),

  (4, 4,
   'Quejas subjetivas de memoria reciente, olvidos reiterados de nombres de conocidos y dificultad para recordar citas médicas.',
   'La hija y cuidadora principal reporta que en los últimos 6 meses Don Gonzalo ha presentado reiterados olvidos de llaves, fechas y medicación, lo que genera leve angustia en el paciente.',
   'No aplica por ser adulto mayor.',
   'Desarrollo normal histórico. Nivel educativo superior (Licenciatura en Economía).',
   'Hipertensión arterial esencial controlada con Losartán 50mg/día. Artrosis leve en rodillas.',
   'Madre con demencia senil no especificada diagnosticada a los 82 años.',
   'Vive con su hija Elena en un ambiente tranquilo y adaptado a sus necesidades.',
   'Consciente, orientado en persona y lugar, con leve desorientación temporal (falla en el día de la semana). Fluidez verbal conservada.',
   'Trastorno Neurocognitivo Menor / Deterioro Cognitivo Leve amnésico de probable etiología neurodegenerativa temprana (CIE-11: 6D71 / DSM-5: 331.83).',
   1, '2026-07-25');

-- 14. NOTAS DE EVOLUCIÓN CONTINUA SOAP INICIALES (MÓDULO E - SPRINT 4)
INSERT OR IGNORE INTO notas_evolucion (id, historia_id, paciente_id, terapeuta_id, usuario_id, numero_sesion, fecha_sesion, hora_inicio, hora_fin, ambiente_id, subjetivo, objetivo, analisis, plan, diagnostico_codigo, diagnostico_glosa, recomendaciones_hogar, asistido_por_ia, sellado, firma_digital_snapshot) VALUES
  (1, 1, 1, 1, 1, 1, '2026-08-25', '15:00', '15:45', 1,
   'El padre manifiesta que el menor continuó con llamados de atención leves por levantarse de su banco. Sin embargo, no presentó quejas de conducta agresiva ni oposicionismo.',
   'Se aplicaron tareas de focalización visual y cancelación de figuras (Test d2). Rendimiento inicial dentro de la media, con caída de precisión a partir del minuto 12. Cooperación excelente.',
   'Se corrobora curva de fatigabilidad atencional típica de perfiles con desregulación en funciones ejecutivas. Muestra buena receptividad al refuerzo positivo verbal.',
   'Entrenamiento en técnicas de respiración diafragmática y estructuración del escritorio de trabajo. Próxima sesión: control inhibitorio mediante consignas Go/No-Go.',
   '6A05.0', 'Trastorno por Déficit de Atención con Hiperactividad',
   'Dividir las tareas escolares de Mateo en bloques de 15 minutos de trabajo activo seguidos de 3 minutos de pausa activa.',
   0, 1, 'Mgr. Grisel Aguilar Apaza · Matrícula CPB-1402 (Neuropsicóloga Clínica)'),

  (2, 1, 1, 1, 1, 2, '2026-09-08', '15:00', '15:45', 1,
   'El padre comenta que la aplicación de los bloques de 15 minutos en el hogar mejoró notablemente la disposición de Mateo para hacer las tareas escolares sin llanto ni quejas.',
   'Se ejecutó el protocolo de memoria operativa visual con cubos de Corsi y software de estimulación cognitiva. Mateo logró reproducir secuencias de hasta 5 elementos directos y 3 inversos.',
   'Evolución favorable en control inhibitorio. Mantiene adecuada motivación intrínseca. Se observa disminución en la necesidad de pararse del asiento durante los primeros 25 minutos.',
   'Continuar con refuerzo de memoria operativa auditiva y fonológica. Coordinación con la profesora de aula para pautas de refuerzo en el asiento delantero.',
   '6A05.0', 'Trastorno por Déficit de Atención con Hiperactividad',
   'Mantener la técnica de temporizador visual y felicitar los logros explícitos al terminar cada bloque.',
   1, 1, 'Mgr. Grisel Aguilar Apaza · Matrícula CPB-1402 (Neuropsicóloga Clínica)'),

  (3, 2, 2, 2, 2, 1, '2026-09-15', '16:00', '16:45', 1,
   'La madre refiere que Luciana continúa confundiendo las letras al leer cuentos cortos antes de dormir, pero se encuentra muy entusiasmada por comenzar sus sesiones.',
   'Evaluación psicopedagógica con batería Prolec-R (identificación de letras y lectura de pseudopalabras). Se observan errores de vacilación y sustitución b/d.',
   'Dificultad en la ruta fonológica de decodificación. Buen vocabulario receptivo. Actitud positiva frente a materiales lúdicos manipulativos.',
   'Trabajo con letras en lija y plastilina sensorial para fijar orientación espacial de grafemas. Coordinar derivación a fonoaudiología para articulación.',
   '6A03', 'Trastorno del Desarrollo del Aprendizaje con dificultades en lectura',
   'Jugar en casa a "veo veo" fonológico enfatizando sonidos iniciales sin presionar la velocidad.',
   0, 1, 'Lic. Claudia Morales Soto · Matrícula CPB-2150 (Psicopedagoga)'),

  (4, 4, 4, 3, 5, 1, '2026-08-05', '10:00', '10:45', 3,
   'La hija comenta que Don Gonzalo se siente más motivado desde que sabe que asistirá a sesiones de memoria. Don Gonzalo expresa deseo de mantener su agilidad mental.',
   'Aplicación del Minimental State Examination (MMSE): puntaje 26/30 (pérdida de puntos en orientación temporal y recuerdo diferido de 3 palabras). MoCA: 24/30.',
   'Desempeño compatible con quejas subjetivas en esfera amnésica episódica. Funciones ejecutivas y lenguaje funcionalmente preservados.',
   'Diseño de libreta de memoria externa personalizada (cuaderno de notas diario). Ejercicios de estimulación cognitiva con reminiscencia biográfica positiva.',
   '6D71', 'Trastorno Neurocognitivo Menor',
   'Supervisar de manera amable la anotación de compromisos y medicamentos en la libreta diaria colocada en la mesa del comedor.',
   1, 1, 'Lic. Valeria Bustamante Ríos · Matrícula CPB-3318 (Psicogerontóloga)');



-- ==============================================================================
-- SPRINT 5: CATÁLOGO NOSOLÓGICO, CARPETAS DIGITALES Y PLANES SMART
-- ==============================================================================

-- 15. CATÁLOGO NOSOLÓGICO CLÍNICO OFICIAL CIE-11 / DSM-5 (MÓDULO E - HU-08)
INSERT OR IGNORE INTO catalogo_diagnosticos (id, sistema, codigo, nombre, categoria, descripcion, criterios_resumen) VALUES
  (1, 'AMBOS', '6A05.0 / F90.0', 'Trastorno por Déficit de Atención con Hiperactividad (TDAH), presentación combinada', 'NEURODESARROLLO', 'Patrón persistente de inatención y/o hiperactividad-impulsividad que interfiere con el funcionamiento escolar o familiar.', 'Síntomas presentes en 2 o más entornos por más de 6 meses; impacto en funciones ejecutivas.'),
  (2, 'AMBOS', '6A05.1 / F90.1', 'Trastorno por Déficit de Atención con Hiperactividad (TDAH), presentación con predominio de inatención', 'NEURODESARROLLO', 'Dificultad marcada para sostener el foco atencional, desorganización y olvidos frecuentes sin exceso motor relevante.', 'Fallas en detalles, lentitud en tareas secuenciales y alta fatigabilidad cognitiva.'),
  (3, 'AMBOS', '6A02 / F84.0', 'Trastorno del Espectro Autista (TEA) - Nivel 1 (Requiere apoyo leve)', 'NEURODESARROLLO', 'Dificultades en reciprocidad socioemocional, comunicación pragmática y patrones de conducta restrictivos o repetitivos.', 'Rigidez cognitiva, hiper/hiporreactividad sensorial e intereses intensos.'),
  (4, 'AMBOS', '6A03.0 / F81.0', 'Trastorno Específico del Aprendizaje con dificultades en la lectura (Dislexia)', 'APRENDIZAJE', 'Alteración en la precisión, velocidad o fluidez de la lectura y decodificación fonológica.', 'Confusión grafema-fonema, omisiones, inversiones de letras (b/d) y baja comprensión lectora.'),
  (5, 'AMBOS', '6A03.1 / F81.1', 'Trastorno Específico del Aprendizaje con dificultades en la expresión escrita (Disgrafía / Disortografía)', 'APRENDIZAJE', 'Dificultad marcada en la claridad gráfica, trazado motor, organización espacial y ortografía.', 'Caligrafía ilegible, prensión inadecuada del lápiz y errores ortográficos no acordes a la edad.'),
  (6, 'AMBOS', '6A03.2 / F81.2', 'Trastorno Específico del Aprendizaje con dificultades en matemáticas (Discalculia)', 'APRENDIZAJE', 'Dificultad severa en el procesamiento numérico, memorización de hechos aritméticos y razonamiento lógico.', 'Fallas en concepto de cantidad, valor posicional y cálculo mental automatizado.'),
  (7, 'AMBOS', '6A01.0 / F80.1', 'Trastorno del Desarrollo del Lenguaje (TDL / Disfasia / Dislalia)', 'LENGUAJE_HABLA', 'Dificultad persistente en la adquisición, producción o comprensión del lenguaje verbal.', 'Vocabulario reducido, estructuración gramatical deficiente o problemas en puntos articulatorios fonéticos.'),
  (8, 'AMBOS', '6D71 / 331.83', 'Trastorno Neurocognitivo Menor / Deterioro Cognitivo Leve amnésico', 'NEUROCOGNITIVO_ADULTO', 'Declive cognitivo moderado respecto a un nivel previo en uno o más dominios cognitivos (memoria episódica, atención).', 'No interfiere significativamente con la independencia en actividades básicas instrumentales de la vida diaria.'),
  (9, 'AMBOS', '6D80 / F00', 'Trastorno Neurocognitivo Mayor debido a la Enfermedad de Alzheimer', 'NEUROCOGNITIVO_ADULTO', 'Deterioro progresivo de la memoria reciente y otras capacidades cognitivas que compromete la autonomía del paciente.', 'Comienzo insidioso, declive continuo en memoria y orientación; requiere supervisión continua.'),
  (10, 'AMBOS', '6B00 / F41.1', 'Trastorno de Ansiedad Generalizada / Ansiedad por Separación Infantil', 'AFECTIVO_CONDUCTUAL', 'Preocupación excesiva, tensión psicomotriz, temores recurrentes o somatizaciones frente a exigencias cotidianas.', 'Irritabilidad, quejas somáticas (dolor de estómago), inquietud y dificultad para conciliar el sueño.');

-- 16. CARPETAS DIGITALES PREDETERMINADAS POR PACIENTE (MÓDULO E - HU-08)
-- Paciente 1: Mateo Fuentes Rocha
INSERT OR IGNORE INTO paciente_carpetas (id, paciente_id, nombre, descripcion, es_sistema, orden) VALUES
  (1, 1, '1. Evaluaciones Neuropsicológicas y Test', 'Protocolos WISC-V, CUMANES, Test d2 y perfiles neurocognitivos', 1, 1),
  (2, 1, '2. Informes Médicos y Neurológicos Externos', 'Dictámenes médicos externos, neuropediatría y pediatría', 1, 2),
  (3, 1, '3. Estudios Clínicos / Laboratorios / EEG / TAC', 'Resultados de laboratorios, electroencefalogramas y neuroimágenes', 1, 3),
  (4, 1, '4. Informes Escolares y Gabinetes Psicopedagógicos', 'Boletines de calificaciones, reportes de profesores y psicología escolar', 1, 4),
  (5, 1, '5. Consentimientos y Documentación Legal', 'Autorizaciones de tratamiento firmadas y fichas de consentimiento', 1, 5),

-- Paciente 2: Luciana Valenzuela Quiroga
  (6, 2, '1. Evaluaciones Neuropsicológicas y Test', 'Protocolos y perfiles de evaluación del aprendizaje', 1, 1),
  (7, 2, '2. Informes Médicos y Neurológicos Externos', 'Informes médicos externos', 1, 2),
  (8, 2, '3. Estudios Clínicos / Laboratorios / EEG / TAC', 'Estudios neurológicos y fonoaudiológicos', 1, 3),
  (9, 2, '4. Informes Escolares y Gabinetes Psicopedagógicos', 'Informes pedagógicos del colegio', 1, 4),
  (10, 2, '5. Consentimientos y Documentación Legal', 'Consentimientos informados firmados', 1, 5),

-- Paciente 4: Gonzalo Bustamante Mendoza
  (11, 4, '1. Evaluaciones Neuropsicológicas y Test', 'Pruebas psicogerontológicas MMSE, MoCA y perfiles de memoria', 1, 1),
  (12, 4, '2. Informes Médicos y Neurológicos Externos', 'Informes geriátricos y cardiológicos', 1, 2),
  (13, 4, '3. Estudios Clínicos / Laboratorios / EEG / TAC', 'Tomografías cerebrales, laboratorios y resonancias', 1, 3),
  (14, 4, '4. Informes Escolares y Gabinetes Psicopedagógicos', 'Documentos de apoyo familiar y cuidadores', 1, 4),
  (15, 4, '5. Consentimientos y Documentación Legal', 'Consentimientos y autorizaciones legales', 1, 5);

-- 17. DOCUMENTOS / ESTUDIOS ADJUNTOS INICIALES (MÓDULO E - HU-08)
INSERT OR IGNORE INTO paciente_documentos (id, carpeta_id, paciente_id, nombre_original, nombre_almacenado, tipo_mime, tamano_bytes, categoria_clinica, descripcion, subido_por_usuario_id) VALUES
  (1, 3, 1, 'Electroencefalograma_Vigilia_Mateo_Fuentes.pdf', 'doc_eeg_mateo_fuentes_seed_2026.pdf', 'application/pdf', 342150, 'LABORATORIO_ESTUDIO', 'Electroencefalograma digital de vigilia realizado por Neuropediatría en Clínica Los Ángeles (Cochabamba). Trazado normal sin paroxismos epileptógenos.', 1),
  (2, 4, 1, 'Informe_Gabinete_Escolar_La_Salle_2026.pdf', 'doc_informe_colegio_mateo_seed_2026.pdf', 'application/pdf', 185400, 'INFORME_ESCOLAR', 'Informe emitido por la psicóloga escolar indicando dificultades para mantenerse sentado y desorganización en cuadernos.', 1),
  (3, 3, 4, 'Tomografia_Axial_Cerebral_TAC_Gonzalo_Bustamante.pdf', 'doc_tac_cerebral_gonzalo_seed_2026.pdf', 'application/pdf', 521800, 'LABORATORIO_ESTUDIO', 'TAC cerebral de control sin contraste. Reporte de leve atrofia córtico-subcortical acorde a edad.', 1);

-- 18. PLANES TERAPÉUTICOS INDIVIDUALIZADOS - PTI INICIALES (MÓDULO F - HU-09)
INSERT OR IGNORE INTO planes_intervencion (id, historia_id, paciente_id, terapeuta_id, diagnostico_codigo, diagnostico_glosa, diagnostico_catalogo_id, titulo, objetivo_general, periodicidad_meses, fecha_inicio, fecha_revision, recomendaciones_familia, estado) VALUES
  (1, 1, 1, 1, '6A05.0', 'Trastorno por Déficit de Atención con Hiperactividad, presentación combinada', 1,
   'Plan PTI: Entrenamiento en Funciones Ejecutivas, Atención Sostenida y Regulación Conductual',
   'Fortalecer el foco atencional selectivo y sostenido hasta 25 minutos continuos, desarrollar el control inhibitorio motor y cognitivo, y establecer hábitos ecológicos de organización escolar y autorregulación en casa y aula.',
   3, '2026-08-20', '2026-11-20',
   'Mantener la estructura visual de tareas con pausas activas programadas (técnica Pomodoro adaptada de 15x3 min) y elogiar explícitamente la persistencia.',
   'ACTIVO');

-- 19. METAS TERAPÉUTICAS SMART (MÓDULO F - HU-09)
INSERT OR IGNORE INTO metas_terapeuticas (id, plan_id, descripcion_meta, area_intervencion, criterio_exito, porcentaje_logro, estado, pautas_hogar, orden) VALUES
  (1, 1, 'Mantener la focalización atencional visual sostenida en tareas académicas durante 25 minutos continuos con un máximo de 1 llamado de atención verbal.',
   'ATENCION_CONCENTRACION', 'Medido mediante cronómetro en consultorio y registro de mesa en tareas escolares con al menos 80% de efectividad.',
   75, 'EN_PROCESO', 'Establecer una rutina diaria con un temporizador visual de mesa para las tareas de la tarde.', 1),

  (2, 1, 'Lograr una tasa de acierto superior al 85% en consignas de control inhibitorio tipo Go / No-Go frente a estímulos distractores auditivos.',
   'FUNCIONES_EJECUTIVAS', 'Evaluado en 3 sesiones consecutivas mediante software de estimulación y reactivos estructurados sin respuestas impulsivas anticipadas.',
   50, 'EN_PROCESO', 'Juegos familiares como "Luz Roja / Luz Verde" o "Simón Dice" para practicar el freno voluntario de impulsos.', 2),

  (3, 1, 'Completar de forma autónoma el guardado y organización de útiles escolares en la mochila siguiendo una lista de cotejo gráfica de 5 pasos.',
   'REGULACION_CONDUCTUAL', 'Cumplimiento verificado por la familia durante 4 semanas consecutivas de lunes a viernes.',
   25, 'EN_PROCESO', 'Colocar la ficha gráfica plastificada de útiles pegada detrás de la puerta del dormitorio de Mateo.', 3);

-- 20. HISTORIAL DE SEGUIMIENTO DE METAS SMART (MÓDULO F - HU-09)
INSERT OR IGNORE INTO seguimiento_metas_historial (id, meta_id, plan_id, paciente_id, terapeuta_id, porcentaje_anterior, nuevo_porcentaje, observaciones_clinicas, sesion_numero, fecha_registro) VALUES
  (1, 1, 1, 1, 1, 0, 25, 'Inicio de entrenamiento. Mateo logra 12 minutos antes de presentar signos de agotamiento atencional.', 1, '2026-08-25 15:45:00'),
  (2, 1, 1, 1, 1, 25, 50, 'Incremento a 18 minutos con técnica de fragmentación y refuerzo positivo.', 2, '2026-09-08 15:45:00'),
  (3, 1, 1, 1, 1, 50, 75, 'Consolidación de 22-25 minutos continuos de concentración en tareas estructuradas.', 3, '2026-10-15 15:45:00'),
  (4, 2, 1, 1, 1, 0, 25, 'Dificultad inicial para frenar respuestas motoras impulsivas ante sonidos fuertes.', 1, '2026-08-25 15:45:00'),
  (5, 2, 1, 1, 1, 25, 50, 'Acierto del 70% en consignas de frenado motriz. Mayor calma en la postura en silla.', 2, '2026-09-08 15:45:00'),
  (6, 3, 1, 1, 1, 0, 25, 'El tutor colocó el pictograma en el dormitorio. Mateo reconoce los pasos con supervisión.', 2, '2026-09-08 15:45:00');

-- 21. CITAS MÉDICAS Y AGENDAMIENTO EN 3 CONSULTORIOS (MÓDULO G - HU-10 - SPRINT 6)
INSERT OR IGNORE INTO citas (id, paciente_id, terapeuta_id, ambiente_id, servicio_id, fecha_hora_inicio, fecha_hora_fin, duracion_minutos, estado, motivo_consulta, motivo_cancelacion, creado_por_usuario_id, asistencia_registrada_at, asistencia_registrada_por_id) VALUES
  -- Citas históricas completadas (2026-11-05)
  (1, 1, 1, 1, 5, '2026-11-05 08:30:00', '2026-11-05 09:15:00', 45, 'ATENDIDA', 'Estimulación de atención selectiva y discriminación visual rápida.', NULL, 1, '2026-11-05 08:28:00', 3),
  (2, 2, 2, 2, 2, '2026-11-05 09:30:00', '2026-11-05 10:30:00', 60, 'ATENDIDA', 'Reeducación de grafemas y discriminación fonológica /b/ y /d/.', NULL, 2, '2026-11-05 09:25:00', 3),
  (3, 4, 3, 3, 4, '2026-11-05 15:00:00', '2026-11-05 16:30:00', 90, 'ATENDIDA', 'Sesión de mantenimiento cognitivo (VGI) - Programa Horizontes Plateados.', NULL, 1, '2026-11-05 14:55:00', 3),
  (4, 3, 4, 2, 3, '2026-11-05 11:00:00', '2026-11-05 12:00:00', 60, 'CANCELADA', 'Consulta conductual y orientación familiar.', 'El tutor solicitó reprogramación por viaje imprevisto de trabajo.', 1, NULL, NULL),
  (13, 5, 5, 3, 5, '2026-11-05 11:30:00', '2026-11-05 12:15:00', 45, 'ATENDIDA', 'Evaluación fonoaudiológica inicial y motricidad orofacial.', NULL, 1, '2026-11-05 11:25:00', 3),

  -- Citas del día actual (2026-11-06)
  (5, 1, 1, 1, 5, '2026-11-06 09:00:00', '2026-11-06 09:45:00', 45, 'EN_ATENCION', 'Entrenamiento en control inhibitorio y pausas activas.', NULL, 1, '2026-11-06 08:58:00', 3),
  (6, 2, 2, 1, 2, '2026-11-06 10:00:00', '2026-11-06 11:00:00', 60, 'CONFIRMADA', 'Intervención en lectoescritura con fichas de autocorrección.', NULL, 2, NULL, NULL),
  (7, 3, 4, 2, 3, '2026-11-06 09:00:00', '2026-11-06 10:00:00', 60, 'CONFIRMADA', 'Evaluación de habilidades sociales y adaptación al aula.', NULL, 1, NULL, NULL),
  (8, 1, 4, 2, 3, '2026-11-06 10:15:00', '2026-11-06 11:00:00', 45, 'PROGRAMADA', 'Orientación conductual en rutinas de estudio en casa.', NULL, 1, NULL, NULL),
  (9, 4, 3, 3, 4, '2026-11-06 15:00:00', '2026-11-06 16:30:00', 90, 'CONFIRMADA', 'Taller de estimulación de memoria episódica y semántica.', NULL, 1, NULL, NULL),
  (14, 5, 5, 3, 5, '2026-11-06 11:30:00', '2026-11-06 12:15:00', 45, 'CONFIRMADA', 'Terapia miofuncional orofacial y articulación fonética.', NULL, 1, NULL, NULL),

  -- Citas para mañana (2026-11-07)
  (10, 2, 5, 1, 5, '2026-11-07 08:30:00', '2026-11-07 09:15:00', 45, 'PROGRAMADA', 'Derivación fonoaudiológica: ejercitación motriz de fonema /r/.', NULL, 2, NULL, NULL),
  (11, 1, 2, 2, 2, '2026-11-07 10:00:00', '2026-11-07 11:00:00', 60, 'PROGRAMADA', 'Refuerzo psicopedagógico en cálculo mental.', NULL, 2, NULL, NULL),
  (12, 4, 3, 3, 3, '2026-11-07 16:00:00', '2026-11-07 17:00:00', 60, 'PROGRAMADA', 'Sesión de orientación psicoeducativa a cuidadores y familiares.', NULL, 1, NULL, NULL);

-- 22. INSTANCIAS DE SESIÓN WHATSAPP PARA LOS 5 TERAPEUTAS OFICIALES (MÓDULO H - HU-11 - SPRINT 7)
INSERT OR IGNORE INTO whatsapp_sesiones (id, terapeuta_id, estado, telefono_vinculado, nombre_dispositivo, conectado_at) VALUES
  (1, 1, 'CONECTADO', '+591 70000001', 'WhatsApp Web (Chrome / Android)', '2026-11-06 08:00:00'),
  (2, 2, 'DESCONECTADO', '+591 70000002', NULL, NULL),
  (3, 3, 'DESCONECTADO', '+591 70000005', NULL, NULL),
  (4, 4, 'DESCONECTADO', '+591 70000006', NULL, NULL),
  (5, 5, 'DESCONECTADO', '+591 70000007', NULL, NULL);

-- ==============================================================================
-- SPRINT 10: CONFIGURACIÓN DE PAGO QR Y CATÁLOGO DE BATERÍAS NEUROCOGNITIVAS
-- ==============================================================================

-- 23. PARÁMETROS INSTITUCIONALES DE PAGO QR BANCARIO
INSERT OR IGNORE INTO configuraciones_sistema (id, clave, valor, descripcion, categoria, es_secreto) VALUES
  (10, 'PAGO_BANCO_NOMBRE', 'Banco Unión S.A. / BCP Bolivia', 'Entidad bancaria receptora de transferencias QR', 'FINANZAS', 0),
  (11, 'PAGO_CUENTA_TITULAR', 'Centro Psicopedagógico y Psicológico PSI Aprende S.R.L.', 'Razón social titular de la cuenta bancaria', 'FINANZAS', 0),
  (12, 'PAGO_CUENTA_NUMERO', '10000049281726 (Cta. Corriente M/N Bolivianos)', 'Número de cuenta oficial de recaudación', 'FINANZAS', 0),
  (13, 'PAGO_QR_INSTRUCCIONES', 'Escanee el código QR desde su aplicación móvil de banca (Simple QR). En la glosa ingrese el código de paciente y adjunte el comprobante.', 'Pautas explicativas para el tutor al momento de pagar', 'FINANZAS', 0);

-- 24. CATÁLOGO PATRIMONIAL DE BATERÍAS NEUROPSICOMÉTRICAS (HU-16)
INSERT OR IGNORE INTO inventario_baterias (id, codigo_patrimonial, nombre, editorial, area_evaluada, piezas_detalle, estado_conservacion, estado_disponibilidad) VALUES
  (1, 'BAT-WISC5-01', 'WISC-V: Escala Wechsler de Inteligencia para Niños (5ta Edición)', 'Pearson Clinical', 'Inteligencia General, CI Total, Comprensión Verbal, Visoespacial, Razonamiento Fluido, Memoria de Trabajo y Velocidad de Procesamiento (6 a 16 años)', 'Maletín azul, 2 cuadernos de estímulos, manual de aplicación, manual técnico, caja de 9 cubos bicolores, cuadernillo de respuestas 1 y 2, 3 plantillas de corrección', 'EXCELENTE', 'DISPONIBLE'),
  (2, 'BAT-BANFE2-01', 'BANFE-2: Batería Neuropsicológica de Funciones Ejecutivas y Lóbulos Frontales', 'Manual Moderno', 'Funciones Ejecutivas, Control Inhibitorio, Flexibilidad Mental, Memoria de Trabajo y Metacognición (Órbito-medial, Prefrontal Anterior y Dorso-lateral)', 'Maletín verde, láminas de aplicación Torre de Hanói, cartas de clasificación, juego de laberintos, manual de aplicación y protocolo', 'EXCELENTE', 'DISPONIBLE'),
  (3, 'BAT-ADOS2-01', 'ADOS-2: Escala de Observación para el Diagnóstico del Autismo (Módulos 1 al 4)', 'TEA Ediciones', 'Comunicación Social, Interacción Lúdica, Conductas Restringidas e Imaginación (Sospecha de TEA / Condición del Espectro Autista)', 'Maletín rígido, juguetes estructurados, libro de imágenes, rompecabezas, juego de figuras geométricas, manual clínico', 'BUENO', 'DISPONIBLE'),
  (4, 'BAT-CUMAN-01', 'CUMANES: Cuestionario de Madurez Neuropsicológica Escolar', 'TEA Ediciones', 'Madurez Neuropsicológica Global, Lenguaje Articulado, Comprensión, Visopercepción, Memoria y Lateralidad (7 a 11 años)', 'Manual de aplicación, cuadernos de estímulo visual, láminas de palabras y pseudopalabras, fichas de dictado y memoria verbal', 'EXCELENTE', 'DISPONIBLE'),
  (5, 'BAT-ENFEN-01', 'ENFEN: Evaluación Neuropsicológica de las Funciones Ejecutivas en Niños', 'TEA Ediciones', 'Senderos, Anillas, Fluidez Fonológica/Semántica e Interferencia Tipo Stroop (6 a 12 años)', 'Tablero de anillas de madera con 3 pivotes, juego de 5 anillas de colores, cuadernillo de senderos grises y en color, manual técnico', 'BUENO', 'DISPONIBLE'),
  (6, 'BAT-MOCA-01', 'MoCA / MMSE: Batería de Cribado Neurocognitivo y Memoria para Adultos y Geriatría', 'Z. Nasreddine / Folstein', 'Atención, Funciones Ejecutivas, Memoria Inmediata/Diferida, Orientación Témporo-espacial y Lenguaje en Adultos Mayores (VGI)', 'Cuadernillos plastificados de aplicación rápida, reloj de evaluación visoespacial, láminas de denominación de animales y manual de baremos', 'EXCELENTE', 'DISPONIBLE');

-- 25. PAGOS INICIALES DE EJEMPLO VINCULADOS A CITAS REALES (HU-15)
INSERT OR IGNORE INTO pagos_citas (id, cita_id, paciente_id, tutor_id, terapeuta_id, monto_bob, metodo_pago, estado, numero_transaccion, observaciones, verificado_por_usuario_id, fecha_pago, fecha_verificacion) VALUES
  (1, 1, 1, 1, 1, 130.00, 'QR_SIMPLE', 'VERIFICADO', 'TRX-BNB-928172', 'Pago confirmado por recepción en turno matutino.', 3, '2026-11-05 08:40:00', '2026-11-05 08:42:00'),
  (2, 2, 2, 2, 2, 150.00, 'EFECTIVO', 'VERIFICADO', 'REC-EFE-0042', 'Cobro en ventanilla de recepción con recibo físico.', 3, '2026-11-05 09:35:00', '2026-11-05 09:36:00'),
  (3, 3, 4, 4, 3, 200.00, 'QR_SIMPLE', 'VERIFICADO', 'TRX-UNION-552190', 'Transferencia Banco Unión verificada por la Lic. Grisel Aguilar.', 1, '2026-11-05 15:10:00', '2026-11-05 15:15:00'),
  (4, 5, 1, 1, 1, 130.00, 'QR_SIMPLE', 'EN_REVISION', 'TRX-BCP-110293', 'Comprobante bancario subido por el tutor Carlos Fuentes desde el portal.', NULL, '2026-11-06 09:15:00', NULL),
  (5, 6, 2, 2, 2, 150.00, 'QR_SIMPLE', 'PENDIENTE', NULL, 'Cita confirmada pendiente de pago de arancel.', NULL, NULL, NULL);

-- 26. CONVENIOS Y ALIANZAS INSTITUCIONALES (SPRINT 11 - MÓDULO O)
INSERT OR IGNORE INTO convenios_institucionales (
  id, nombre_institucion, tipo_institucion, descripcion_convenio, beneficio_familias,
  imagen_url, telefono_contacto, email_contacto, direccion, sitio_web, destacado, activo, orden
) VALUES
  (1, 'Colegio Alemán Federico Froebel', 'Colegio / Unidad Educativa', 
   'Alianza de articulación psicopedagógica y seguimiento en aula para estudiantes con TDAH, dificultades del aprendizaje y altas capacidades. Se coordinan reuniones periódicas entre las terapeutas de PSI Aprende y el gabinete de orientación escolar.',
   '15% de descuento en Evaluaciones Psicopedagógicas Integrales y acceso preferencial a talleres bimestrales de pautas de crianza positiva para padres froebelinos.',
   '/uploads/convenios/convenio_colegio_froebel.svg',
   '+591 4 4281234', 'orientacion@froebel.edu.bo', 'Av. América Oeste N° 850, Cala Cala, Cochabamba', 'https://froebel.edu.bo', 1, 1, 1),

  (2, 'Centro Pediátrico Neurológico "San Rafael"', 'Centro Médico / Neurológico',
   'Convenio de interconsulta y derivación prioritaria con el equipo de Neuropediatría y Neurofisiología para estudios de Electroencefalograma, Mapeo Cerebral Computarizado y despistaje de epilepsia infantil.',
   'Turnos preferenciales en menos de 48 horas para estudios neurológicos y 10% de descuento en consultas con especialistas de planta.',
   '/uploads/convenios/convenio_neurologia_sanrafael.svg',
   '+591 4 4529000', 'neurologia@sanrafael-cbba.com', 'Calle Colombia esq. Baptista, Edif. Médico San Rafael, Piso 2, Cochabamba', 'https://sanrafael-cbba.com', 1, 1, 2),

  (3, 'Gabinete de Fonoaudiología y Foniatría "Voz & Oído"', 'Centro de Estimulación / Terapia',
   'Convenio de atención integral para pacientes con retrasos del lenguaje, trastornos de los sonidos del habla, deglución atípica y pruebas de audiometría tonal infantil.',
   'Primera consulta de tamizaje fonoaudiológico sin costo para niños inscritos en PSI Aprende y arancel institucional reducido en sesiones semanales de habla.',
   '/uploads/convenios/convenio_voz_y_oido.svg',
   '+591 76912345', 'contacto@vozyoido.com.bo', 'Av. Ballivián El Prado N° 620, Edif. Los Tiempos, Mezzanina, Cochabamba', NULL, 0, 1, 3),

  (4, 'Fundación Síndrome de Down Cochabamba - Funsidown', 'Fundación / Asociación',
   'Alianza comunitaria y social para la estimulación neurocognitiva, psicomotricidad fina y desarrollo de habilidades adaptativas e inclusión escolar para niños y adolescentes con Síndrome de Down.',
   'Arancel social subvencionado en sesiones de neurodesarrollo y libre acceso a grupos de apoyo emocional y orientación familiar.',
   '/uploads/convenios/convenio_fundacion_down.svg',
   '+591 4 4456789', 'directiva@funsidown.org.bo', 'Calle Beni e/ Santa Cruz y Villarroel N° 415, Cochabamba', 'https://funsidown.org.bo', 1, 1, 4),

  (5, 'Unidad Educativa Anglo Americano Cochabamba', 'Colegio / Unidad Educativa',
   'Convenio de cooperación académica para adaptaciones curriculares no significativas, observación en el aula y seguimiento continuo del proceso de aprendizaje y conducta socioemocional.',
   'Canal directo de comunicación sin intermediarios entre el gabinete psicopedagógico escolar y las psicólogas de PSI Aprende, además de bonificación especial en informes escolares para admisiones.',
   '/uploads/convenios/convenio_anglo_americano.svg',
   '+591 4 4245678', 'psicologia@angloamericano.edu.bo', 'Calle Aurelio Melean N° 230, Sarco, Cochabamba', 'https://angloamericano.edu.bo', 0, 1, 5);

-- SPRINT 12: SEMILLAS PARA TALLERES, CURSOS Y WEBINARS
INSERT OR IGNORE INTO talleres (
  id, titulo, subtitulo, tipo, categoria, terapeuta_principal_id, expositor_nombre, expositor_cargo,
  telefono_contacto, fecha, hora, lugar, direccion, arancel, arancel_detalle,
  cupos_totales, cupos_ocupados, dirigido_a, temas_json, activo, destacado
) VALUES
  (1, 'Taller Práctico: Crianza Respetuosa y Regulación de Rabietas en el Hogar',
   'Estrategias neurocognitivas de contención y calma para niños de 3 a 8 años',
   'Presencial', 'Padres', 1, 'Lic. Grisel Aguilar Apaza', 'Neuropsicóloga Infantil · Matrícula CPB-1402',
   '+591 70000001', 'Sábado 28 de Noviembre de 2026', '09:30 a 11:30',
   'Sede PSI Aprende · Consultorio 1 y Sala Lúdica Infantil',
   'Calle Ladislao Cabrera entre Antezana y 16 de Julio, Cochabamba',
   '50 Bs', 'Incluye cuadernillo de pautas para el hogar y certificado de asistencia',
   14, 9,
   'Padres de familia, madres, tutores y cuidadores de niños en etapa preescolar y primaria temprana.',
   '["¿Por qué ocurren las rabietas? Funcionamiento de la amígdala y corteza prefrontal infantil.", "Diferencia entre berrinche manipulativo y desborde por sobrecarga sensorial.", "Pautas de co-regulación: qué decir y qué evitar durante el momento de crisis.", "Construcción del rincón de la calma y acuerdos familiares sin castigos físicos ni gritos."]',
   1, 1),

  (2, 'Webinar: Detección Temprana de TDAH y TEA en el Aula y el Hogar',
   'Signos sutiles de alerta clínica y protocolos de derivación oportuna',
   'Virtual', 'Docentes & Padres', 2, 'Lic. Claudia Morales Soto y Equipo Clínico', 'Especialista en Evaluación Neuropsicológica y Psicopedagogía',
   '+591 62717425', 'Jueves 03 de Diciembre de 2026', '19:30 a 21:00',
   'Transmisión en Vivo vía Google Meet con Grabación de Acceso Posterior',
   'Modalidad En Línea para toda Bolivia',
   'Acceso Libre y Gratuito', 'Inscripción sin costo previa reserva de cupo virtual',
   60, 42,
   'Profesores de nivel inicial y primario, gabinetes psicopedagógicos escolares, psicólogos y familias.',
   '["Hitos esperados del neurodesarrollo motor, comunicativo y de interacción social.", "Inquietud motora vs impulsividad ejecutiva: cómo distinguir TDAH en edad escolar.", "Flexibilidad conductual y procesamiento sensorial en el espectro autista TEA.", "Articulación entre colegio y centro terapéutico: informes diagnósticos y adaptaciones curriculares."]',
   1, 1),

  (3, 'Taller Lúdico: Estimulación de la Lectoescritura y Conciencia Fonológica',
   'Juegos estructurados para superar confusiones de letras y ganar fluidez lectora',
   'Presencial', 'Padres & Niños', 3, 'Lic. Valeria Bustamante Ríos', 'Fonoaudióloga y Terapeuta de Lenguaje y Aprendizaje',
   '+591 70000005', 'Sábado 05 de Diciembre de 2026', '10:00 a 12:00',
   'Sede PSI Aprende · Consultorio 2 - Psicopedagogía y Aprendizaje',
   'Calle Ladislao Cabrera entre Antezana y 16 de Julio, Cochabamba',
   '60 Bs', 'Incluye kit de fichas fonológicas y ejercicios para practicar en casa',
   10, 7,
   'Niños de 1º a 3º de Primaria acompañados de uno de sus progenitores o tutores.',
   '["Ejercicios prácticos de discriminación auditiva y rimas fonéticas.", "Estrategias para niños que confunden letras espejo como b y d o invierten sílabas.", "Cómo motivar la lectura diaria en el hogar sin batallas ni frustración escolar.", "Técnicas multisensoriales para afianzar el trazo y la grafomotricidad."]',
   1, 0),

  (4, 'Círculo de Encuentro: Gimnasia Mental y Estimulación Cognitiva Activa',
   'Programa Horizontes Plateados para la memoria, sociabilización y autonomía',
   'Presencial', 'Adultos Mayores', 4, 'Lic. Rodrigo Méndez Salinas', 'Especialista en Psicogerontología y Neurocognición',
   '+591 70000006', 'Miércoles 09 de Diciembre de 2026', '15:30 a 17:00',
   'Sede PSI Aprende · Sala 3 - Neurocognitiva y Psicomotricidad',
   'Calle Ladislao Cabrera entre Antezana y 16 de Julio, Cochabamba',
   'Entrada Libre', 'Actividad comunitaria de responsabilidad social del centro',
   12, 8,
   'Adultos mayores a partir de los 60 años y sus familiares cuidadores.',
   '["Dinámicas lúdicas de activación mnésica, cálculo y atención focalizada.", "Mitos y realidades sobre los olvidos normales vs señales de deterioro cognitivo.", "Rutinas de hidratación, descanso y gimnasia cerebral recomendadas.", "Espacio de diálogo, escucha afectiva y fortalecimiento de vínculos familiares."]',
   1, 0);

-- ==============================================================================
-- CARPETAS Y REPOSITORIO DE MATERIALES CLÍNICOS PARA TERAPEUTAS
-- ==============================================================================
INSERT OR IGNORE INTO materiales_carpetas (id, nombre, descripcion, color, icono, creado_por_usuario_id, es_publico, activo) VALUES
  (1, 'Fichas de Estimulación Fonológica & Habla', 'Material para fonemas /r/, /s/, conciencia fonológica, discriminación auditiva y fichas de articulación.', '#584294', 'folder', 1, 1, 1),
  (2, 'Entrenamiento en Funciones Ejecutivas & TDAH', 'Laberintos, fichas Go/No-Go, entrenamiento de atención sostenida y pautas de autorregulación motora.', '#15968D', 'folder', 1, 1, 1),
  (3, 'Psicopedagogía & Dificultades de Aprendizaje', 'Fichas de lectura guiada, discriminación de grafemas espejo (b/d, p/q) y cálculo estructurado.', '#4B53A6', 'folder', 2, 1, 1),
  (4, 'Psicogerontología & Memoria (Adulto Mayor)', 'Programa Horizontes Plateados: dinámicas mnésicas, orientación témporo-espacial y cálculo mental.', '#F59E0B', 'folder', 5, 1, 1),
  (5, 'Guías Psicoeducativas para Familias & Colegios', 'Manuales breves en PDF de pautas de crianza, adaptaciones de aula y recomendaciones para el hogar.', '#10B981', 'folder', 1, 1, 1);



