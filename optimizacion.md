# Plan Maestro de Optimización, Seguridad y Blindaje — PSI Aprende PWA

**Propósito:** Hoja de ruta incremental dividida en partes independientes y seguras para blindar seguridad, integridad clínica/financiera, consistencia de fechas y rendimiento del sistema **sin romper ninguna funcionalidad actual**.  
**Estrategia de aplicación:** Cada parte se implementa, se prueba de extremo a extremo y se valida antes de avanzar a la siguiente.

> **REGLA INQUEBRANTABLE DEL PLAN (CERO CAMBIOS FUNCIONALES):**
> * **NO agregar nuevas funcionalidades** ni módulos no solicitados.
> * **NO quitar, ocultar ni alterar funcionalidades ya existentes y aprobadas** (todos los flujos de `ADMIN`, `TERAPEUTA`, `RECEPCION`, `TUTOR` y Público, así como el diseño `DESIGN_RULES.md`, deben mantenerse idénticos para el usuario legítimo).
> * **Alcance estricto:** Solo optimizar código/tráfico existente y corregir vulnerabilidades internas, condiciones de carrera, validaciones o fallos detectados.
> * En cada parte se debe verificar primero que el flujo legítimo actual sigue funcionando igual y luego confirmar que el fallo/vulnerabilidad quedó bloqueado.

---

## Resumen de Fases

| Fase | Nombre | Prioridad | Impacto principal |
| :-: | :--- | :--- | :--- |
| **Parte 1** | Blindaje de Control de Acceso (IDOR) y Descarga Segura de Archivos Privados | Crítica | Evita que un usuario vea expedientes, pagos, informes, consentimientos o sesiones WhatsApp de terceros |
| **Parte 2** | Seguridad en Subida de Archivos (Multiformato, Magic Bytes y `fileFilter`) | Crítica | Impide subir ejecutables/HTML disfrazados o archivos corruptos en pagos, QR e informes |
| **Parte 3** | Protección XSS en Frontend y Endurecimiento de Sesión / Botón Atrás | Crítica / Alta | Evita ejecución de scripts maliciosos en 13 vistas/componentes y protege sesiones al navegar hacia atrás |
| **Parte 4** | Reglas de Negocio Financieras/Clínicas y Condiciones de Carrera (Race Conditions) | Alta | Garantiza cero citas simultáneas por milisegundo, cero préstamos dobles y cero montos inválidos/duplicados |
| **Parte 5** | Validación Sincronizada (DTOs) y Estandarización de Zonas Horarias (`America/La_Paz` / UTC) | Alta | Unifica validaciones frontend-backend y elimina desfases de fecha después de las 20:00 en Bolivia |
| **Parte 6** | Rendimiento, Compresión HTTP y Reducción de Polling (100+ usuarios simultáneos) | Media | Reduce ancho de banda (gzip), evita consultas repetidas cada 6s y prepara la base para mayor concurrencia |

---

## Parte 1: Blindaje de Control de Acceso (IDOR) y Archivos Privados
**Objetivo:** Garantizar en el backend que cada rol (`TUTOR`, `TERAPEUTA`, `RECEPCION`, `ADMIN`) solo pueda consultar o modificar recursos que le pertenecen o tiene asignados.

1. **Pagos y Comprobantes (`backend/services/paymentService.js`, `backend/controllers/paymentController.js`):**
   - En `getPaymentById` y `viewReceipt`: validar que si `currentUser.rol === 'TUTOR'`, el pago corresponda al tutor autenticado o a uno de sus hijos vinculados en `paciente_tutor`.
   - En `uploadReceipt`: verificar que un `TUTOR` solo pueda subir comprobantes de sus propios pagos pendientes/rechazados (y no sobreescribir pagos de otros ni pagos ya `VERIFICADO`).
   - En `ensurePaymentForAppointment`: validar propiedad de la cita según el rol antes de consultar o generar la orden de pago.
   - En `viewReceipt`: asegurar que `filePath` resuelva estrictamente dentro de `uploads/receipts` (prevención de *path traversal*).
2. **Consentimientos Informados (`backend/controllers/consentController.js`, `backend/services/consentService.js`):**
   - Validar pertenencia del `patientId` / `consentId` en `checkConsentStatus`, `getConsentsByPatient`, `getConsentById` y `createConsent` (reutilizando validación de tutela legal para `TUTOR` y asignación/derivación para `TERAPEUTA`).
3. **Informes Clínicos Oficiales (`backend/controllers/documentReportController.js`, `backend/services/documentReportService.js`):**
   - Validar acceso por paciente asignado (`TERAPEUTA`) o tutela legal (`TUTOR`) en `getReportById`, `getReportsByPatient`, `downloadDocx` y `downloadSignedDocument`.
   - Mantener la regla de que `TUTOR` solo puede ver/descargar informes marcados como `entregable_familiar`.
4. **Pacientes y Vínculos (`backend/controllers/patientController.js`, `backend/services/patientService.js`):**
   - Validar propiedad del expediente en `getTutorsByPatient` y `getDerivations` cuando el solicitante es `TERAPEUTA`.
5. **Canales WhatsApp (`backend/controllers/whatsappController.js`):**
   - Cuando `req.user.rol === 'TERAPEUTA'`, validar en `getSession`, `initializeSession`, `disconnectSession` y `sendTestMessage` que `therapistId` corresponda al propio usuario autenticado (evitando manipular la sesión de WhatsApp de otro colega).
6. **Protección de Archivos Sensibles en `/uploads` (`backend/server.js`):**
   - Restringir el acceso público directo de `express.static` únicamente a recursos públicos institucionales (`/uploads/convenios`, `/uploads/workshops`, `/uploads/qr`, `/uploads/therapists`, `/uploads/config`), dejando `/uploads/receipts`, `/uploads/reports` y `/uploads/patient_documents` servidos exclusivamente mediante sus rutas autenticadas con verificación RBAC/IDOR.

**Criterio de verificación Parte 1:** Pruebas con tokens de `TUTOR A` intentando acceder a IDs de `TUTOR B` y `TERAPEUTA A` intentando acceder a IDs de `TERAPEUTA B` deben responder `403 Forbidden`, mientras que los accesos legítimos funcionan con normalidad.

---

## Parte 2: Seguridad en Subida de Archivos (*Unrestricted File Upload* y *Magic Bytes*)
**Objetivo:** Asegurar que todo archivo subido al servidor corresponda realmente al formato esperado tanto por tipo MIME, extensión y firma binaria (*magic bytes*).

1. **Helper Central de Validación Binaria (`backend/utils/fileValidator.js`):**
   - Validar encabezados binarios reales (*magic bytes*) para:
     - Imágenes: `PNG` (`89 50 4E 47`), `JPEG` (`FF D8 FF`), `WEBP` (`RIFF....WEBP`).
     - Documentos: `PDF` (`%PDF-`), `DOCX` (`50 4B 03 04` con validación de estructura OOXML / ZIP).
   - Rechazar y eliminar automáticamente del disco temporal cualquier archivo cuya firma real no coincida (ej. un `.exe` o `.html` renombrado a `.jpg`).
   - Bloquear o sanitizar SVGs que contengan etiquetas `<script>` o eventos `on*`.
2. **Completar `fileFilter` en rutas faltantes (`backend/routes/paymentRoutes.js`, `backend/routes/documentReportRoutes.js`):**
   - En `paymentRoutes.js`: `uploadReceipt` solo permite JPEG, PNG, WEBP y PDF; `uploadQr` solo imágenes PNG, JPEG y WEBP (sin permitir HTML ni ejecutables).
   - Validar también el contenido y formato real cuando un comprobante se envíe en `comprobante_base64` (prefijo `data:image/(png|jpeg|webp);base64,` y tamaño decodificado máximo).
   - En `documentReportRoutes.js`: agregar `fileFilter` estricto (PDF, DOCX, JPEG, PNG) + verificación de *magic bytes*.
3. **Extender verificación *magic bytes* al resto de rutas con `multer`:**
   - Aplicar el helper en `clinicalRecordRoutes.js`, `batteryRoutes.js`, `convenioRoutes.js`, `configRoutes.js`, `therapistRoutes.js` y `materialRoutes.js`.

**Criterio de verificación Parte 2:** Intentar subir un archivo `.txt`/`.html`/`.exe` renombrado a `.jpg` o `.pdf` debe ser rechazado con error `400` y no quedar almacenado en `backend/uploads`.

---

## Parte 3: Protección XSS en Frontend, Endurecimiento de Sesión y Botón Atrás
**Objetivo:** Eliminar vectores de ejecución de scripts en el navegador y fortalecer el ciclo de vida de la sesión ante navegación con botón Atrás o fuerza bruta.

1. **Utilidad Global de Escape HTML (`frontend/src/js/utils/sanitize.js`):**
   - Centralizar `escapeHtml(str)` y `sanitizeUrl(url)` (permitiendo únicamente `http:`, `https:`, `/` relativo y `data:image/` seguro, bloqueando `javascript:`).
2. **Aplicar `escapeHtml()` en las 13 vistas/componentes detectados sin escape:**
   - Vistas: `AdminConveniosView.js`, `TherapistsView.js`, `UsersView.js`, `LoginView.js`, `TutorConveniosView.js`, `TutorSpecialtiesCatalogView.js`.
   - Componentes: `Navbar.js`, `NotificationCenter.js`, `ConfirmModal.js`, `ConvenioCarouselModal.js`, `ImageLightboxModal.js`, `SpecialtyDetailsModal.js`, `Toast.js`.
   - Revisar cualquier `innerHTML` en las demás vistas que interpole texto del usuario/BD sin escapar.
3. **Seguridad de Sesión y Botón Atrás (`frontend/src/js/store.js`, `frontend/src/js/router.js`, `frontend/src/js/app.js`):**
   - En `store.isAuthenticated()`: decodificar el payload del JWT (`exp`) para verificar localmente si el token expiró antes de permitir que `Router` renderice cualquier vista protegida.
   - Al cerrar sesión o detectar `401`, limpiar estado en memoria, `localStorage` y forzar renderizado limpio en `#/login` sin dejar restos en `#main-view`.
   - Agregar listener `pageshow` en `app.js` para detectar restauración desde *BFCache* del navegador al presionar "Atrás" y revalidar autenticación inmediatamente.
4. **Endurecimiento Auth y Secretos (`backend/routes/authRoutes.js`, `backend/config/environment.js`):**
   - Agregar limitador de intentos (*rate limiter* ligero en memoria o librería) en `/api/auth/login` y `/api/auth/register` para frenar ataques de fuerza bruta.
   - En `environment.js`: emitir advertencia clara en consola (o exigir variable en `NODE_ENV=production`) si no existe `JWT_SECRET` configurado en `.env`.

**Criterio de verificación Parte 3:** Guardar `<img src=x onerror=alert(1)>` en nombres o textos debe mostrarse como texto plano inofensivo; al cerrar sesión y presionar "Atrás" el usuario es redirigido de inmediato a `#/login` sin ver información clínica previa.

---

## Parte 4: Reglas de Negocio Clínicas/Financieras y Condiciones de Carrera (*Race Conditions*)
**Objetivo:** Blindar la consistencia de agenda, pagos e inventario ante dobles clics o peticiones simultáneas en el mismo milisegundo.

1. **Transacciones Atómicas en Agenda (`backend/repositories/sqlite/SqliteAppointmentRepository.js`, `backend/services/appointmentService.js`):**
   - Envolver verificación anti-colisión (`checkCollision`) + inserción/actualización (`create` / `update`) dentro de `db.transaction(...).immediate()` (equivale a `BEGIN IMMEDIATE` en SQLite), impidiendo que dos solicitudes concurrentes pasen el control al mismo tiempo y reserven la misma sala o terapeuta.
2. **Integridad en Inventario de Baterías (`backend/repositories/sqlite/SqliteBatteryRepository.js`, `backend/services/batteryService.js`):**
   - Mover la comprobación de `estado_disponibilidad = 'DISPONIBLE'` y la mora del terapeuta **dentro** de la misma transacción `immediate()` del préstamo, añadiendo `WHERE id = ? AND estado_disponibilidad = 'DISPONIBLE'` y comprobando `changes === 1`.
3. **Reglas Financieras y Antiduplicados en Pagos (`backend/services/paymentService.js`, `backend/repositories/sqlite/SqlitePaymentRepository.js`):**
   - Validar `monto > 0` (rechazando montos negativos, cero o `NaN`) tanto al emitir solicitudes de cobro como al registrar efectivo.
   - Impedir que `registerCashPayment` o `ensurePaymentForAppointment` dupliquen pagos si la cita ya cuenta con un pago `VERIFICADO` (envuelto en transacción atómica).
   - Impedir modificar o subir un comprobante a un pago cuyo estado ya sea `VERIFICADO`.
   - Evitar reutilización de un mismo `numero_transaccion` no nulo ya aprobado en otro pago verificado.
4. **Regla Temporal en Citas:**
   - Validar en `appointmentService.js` que no se agenden citas nuevas en fechas/horas pasadas (con una tolerancia razonable en minutos para registros en recepción del mismo momento si aplica, configurable y explícita).
5. **Protección Antiduplicado de Clic en UI (`frontend/src/js/`):**
   - Revisar botones de acción rápida y modales secundarios para garantizar estado de carga (`disabled` + texto de procesando) mientras dura la petición.

**Criterio de verificación Parte 4:** Lanzar dos peticiones `POST /api/appointments` paralelas (`Promise.all`) para el mismo horario/sala debe aprobar exactamente 1 y rechazar la segunda con `409 Conflict`; enviar `monto: -50` en pagos debe responder `400 Bad Request`.

---

## Parte 5: Validación Sincronizada (DTOs) y Estandarización de Zonas Horarias
**Objetivo:** Unificar las validaciones de entrada entre navegador y servidor y corregir el desfase de fechas entre hora local de Bolivia (`UTC-4`) y `UTC`.

1. **DTOs con `validateBody` en Rutas Faltantes (`backend/routes/`):**
   - Añadir validadores estructurados (tipos, rangos numéricos, longitudes máximas y campos requeridos) en `paymentRoutes.js`, `consentRoutes.js`, `documentReportRoutes.js`, `convenioRoutes.js`, `workshopRoutes.js` y `therapistRoutes.js`.
   - Asegurar correspondencia exacta entre reglas del formulario frontend y DTO del backend.
2. **Helper Único de Fecha y Hora Institucional `America/La_Paz` (`backend/utils/dateTime.js` y `frontend/src/js/utils/dateTime.js`):**
   - Reemplazar las llamadas sueltas a `new Date().toISOString().split('T')[0]` y la mezcla entre `CURRENT_TIMESTAMP` (UTC) y `datetime('now', 'localtime')` en `paymentService.js`, `clinicalRecordService.js`, `SqlitePaymentRepository.js` y `SqliteAppointmentRepository.js`.
   - Estandarizar el formato de fecha clínica local (`YYYY-MM-DD HH:MM:SS` en hora de Bolivia `-04:00`) o guardar timestamps ISO con offset explícito para evitar que pagos o aperturas de expediente registrados después de las **20:00 (hora Bolivia)** cambien al día siguiente por conversión a UTC.

**Criterio de verificación Parte 5:** Simular hora local `22:30` en Bolivia (`UTC-4`) y comprobar que la fecha registrada en pagos, citas, apertura de historia clínica y vencimiento de QR coincide exactamente con el día local en curso.

---

## Parte 6: Rendimiento, Compresión HTTP y Optimización de Polling (Escalabilidad 100+ Usuarios)
**Objetivo:** Reducir consumo de ancho de banda, bajar drásticamente peticiones repetitivas en terminal y optimizar recursos del servidor.

1. **Compresión HTTP (`backend/server.js`):**
   - Instalar y configurar middleware `compression` en Express para comprimir automáticamente respuestas JSON, CSS y JS (`gzip` / `brotli`).
2. **Optimización de Sondeo / Polling (`frontend/src/js/components/NotificationCenter.js`, `frontend/src/js/views/admin/AppointmentsView.js`):**
   - Evaluar y optimizar el intervalo de polling actual de `6 segundos`:
     - **Opción A (Segura y mínima):** Subir a `20–30 segundos` con pausa estricta cuando la pestaña está oculta y recarga instantánea al volver el foco (`visibilitychange` / `focus`) o al disparar eventos internos.
     - **Opción B (Profesional en tiempo real):** Implementar un canal **SSE (`Server-Sent Events`)** ligero en `/api/notifications/stream` que notifique al instante solo cuando haya una nueva notificación o cambio de cita, eliminando por completo las peticiones periódicas innecesarias de 100+ clientes.
3. **Optimización de Renderizado del Shell (`frontend/src/js/app.js`):**
   - Evitar reconstruir todo el DOM de `#navbar-container` y `#sidebar-container` cuando solo cambia una ruta dentro del mismo estado autenticado, actualizando únicamente las clases `.active` en lugar de destruir y recrear todo el `innerHTML` y sus listeners en cada navegación.
4. **Higiene y Limpieza de Sesiones Puppeteer / Chromium (`backend/services/whatsappManager.js`):**
   - Documentar y añadir monitoreo básico de memoria por instancia activa de Chromium e iniciar sesiones bajo demanda o con cierre limpio ante desconexión definitiva.

**Criterio de verificación Parte 6:** Verificar cabecera `Content-Encoding: gzip` en respuestas `/api`, confirmar caída drástica de logs repetitivos en terminal por minuto y comprobar que `vite build` + flujo completo en móvil y escritorio siguen funcionando al 100%.

---

## Registro de Progreso

- [x] **Parte 1:** Control de Acceso (IDOR) y `/uploads` privados (Completada y verificada)
- [x] **Parte 2:** Seguridad en subida de archivos (*fileFilter* + *magic bytes*) (Completada y verificada)
- [x] **Parte 3:** XSS en frontend + validación local de expiración/BFCache + rate limit login (Completada y verificada)
- [x] **Parte 4:** Transacciones atómicas (citas/baterías) + lógica de negocio financiera (Completada y verificada)
- [x] **Parte 5:** DTOs sincronizados + estandarización de zona horaria (Completada y verificada)
- [x] **Parte 6:** Compresión HTTP + optimización de polling/SSE + optimización de navegación (Completada y verificada)
