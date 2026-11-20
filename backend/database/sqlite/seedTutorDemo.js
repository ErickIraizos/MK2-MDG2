import { DatabaseConnection } from '../../core/DatabaseConnection.js';

const db = DatabaseConnection.getInstance();

console.log('[Seed Tutor Demo] Iniciando carga de datos interactivos para el portal del tutor...');

// 1. Verificar si Camila Sofía (paciente_id = 5) ya tiene plan de intervención
const existingPlanCamila = db.prepare(`SELECT id FROM planes_intervencion WHERE paciente_id = 5`).get();

let planCamilaId = existingPlanCamila ? existingPlanCamila.id : null;

if (!planCamilaId) {
  const insertPlan = db.prepare(`
    INSERT INTO planes_intervencion (
      historia_id, paciente_id, terapeuta_id, diagnostico_codigo, diagnostico_glosa,
      titulo, objetivo_general, periodicidad_meses, fecha_inicio, fecha_revision,
      recomendaciones_familia, estado
    ) VALUES (
      5, 5, 5, 'F80.1', 'Trastorno del lenguaje expresivo y articulación fonológica',
      'Plan PTI: Estimulación del Lenguaje Expresivo, Conciencia Fonológica y Articulación',
      'Desarrollar patrones fonético-fonológicos funcionales, discriminación auditiva y estructuración oracional en contextos sociofamiliares cotidianos.',
      3, '2026-10-15', '2027-01-15',
      'Reforzar la lectura dialógica de 15 minutos en el hogar cada noche y realizar praxias lúdicas frente al espejo.',
      'ACTIVO'
    )
  `);
  const info = insertPlan.run();
  planCamilaId = info.lastInsertRowid;
  console.log(`[Seed] Plan PTI creado para Camila Sofía con ID: ${planCamilaId}`);

  // Insertar Metas SMART para Camila
  const insertMeta = db.prepare(`
    INSERT INTO metas_terapeuticas (
      plan_id, descripcion_meta, area_intervencion, criterio_exito, porcentaje_logro, estado, pautas_hogar, orden
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMeta.run(
    planCamilaId,
    'Lograr la articulación funcional del fonema vibrante múltiple /r/ y sinfones con /l/ en habla espontánea.',
    'LENGUAJE_COMUNICACION',
    '3 aciertos de cada 4 intentos en conversación natural con el entorno familiar.',
    50,
    'EN_PROCESO',
    'Realizar juegos de soplo y praxias linguales lúdicas (el "tren" y la "moto") frente al espejo 10 minutos al día.',
    1
  );

  insertMeta.run(
    planCamilaId,
    'Segmentar y reconocer sílabas en palabras bisílabas y trisílabas mediante palmadas rítmicas con 90% de exactitud.',
    'FUNCIONES_EJECUTIVAS',
    'Identificación auditiva autónoma de sílaba inicial y conteo silábico estructurado.',
    75,
    'EN_PROCESO',
    'Jugar a dar palmadas por cada sílaba nombrando frutas, juguetes y objetos de la casa a la hora del almuerzo.',
    2
  );
  console.log('[Seed] Metas SMART creadas para Camila Sofía.');
} else {
  console.log(`[Seed] Camila Sofía ya posee el plan ID: ${planCamilaId}`);
}

// 2. Limpiar registros de prueba anteriores en tutor_seguimiento_hogar para asegurar consistencia limpia
db.prepare(`DELETE FROM tutor_seguimiento_hogar WHERE tutor_id = 1`).run();

// 3. Obtener metas de Mateo (paciente_id = 1, plan_id = 1)
const metasMateo = db.prepare(`SELECT id, orden FROM metas_terapeuticas WHERE plan_id = 1 ORDER BY orden ASC`).all();
const metasCamila = db.prepare(`SELECT id, orden FROM metas_terapeuticas WHERE plan_id = ? ORDER BY orden ASC`).all(planCamilaId);

const insertCheckin = db.prepare(`
  INSERT INTO tutor_seguimiento_hogar (
    meta_id, paciente_id, tutor_id, nivel_respuesta, observacion_hogar, fecha_registro
  ) VALUES (?, ?, ?, ?, ?, ?)
`);

// Check-ins para Mateo (paciente_id = 1, tutor_id = 1)
if (metasMateo.length >= 3) {
  // Meta 1: Focalización atencional 25 min
  insertCheckin.run(
    metasMateo[0].id,
    1,
    1,
    'FLUIDO',
    'Completó sus actividades escolares con el temporizador visual de 25 minutos sin levantarse de la mesa ni dispersarse.',
    '2026-11-02'
  );

  // Meta 2: Control inhibitorio Go / No-Go
  insertCheckin.run(
    metasMateo[1].id,
    1,
    1,
    'FLUIDO',
    'Jugamos en el patio a "Simón Dice" y "Luz Roja / Luz Verde". Frenó sus movimientos de inmediato al escuchar la señal de alto y se mostró muy motivado.',
    '2026-11-03'
  );

  // Meta 3: Organización de mochila
  insertCheckin.run(
    metasMateo[2].id,
    1,
    1,
    'CON_APOYO',
    'Siguió los pasos 1 al 3 de la ficha plastificada de forma autónoma. Solo necesitó un recordatorio visual para verificar el estuche de colores.',
    '2026-11-04'
  );
  console.log('[Seed] 3 Check-ins interactivos registrados para Mateo Fuentes Rocha.');
}

// Check-in para Camila (paciente_id = 5, tutor_id = 1)
if (metasCamila.length >= 1) {
  insertCheckin.run(
    metasCamila[0].id,
    5,
    1,
    'CON_APOYO',
    'Realizamos las praxias linguales frente al espejo durante 10 minutos. Logró articular el sonido de la moto con apoyo de la guía rítmica.',
    '2026-11-04'
  );
  console.log('[Seed] 1 Check-in interactivo registrado para Camila Sofía Fuentes Rocha.');
}

console.log('[Seed Tutor Demo] Finalizado exitosamente.');

