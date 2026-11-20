# 🛡️ Guía de Seguridad Integral — Sistema Clínico PSI Aprende

> **Propósito del Documento:**  
> Este documento detalla de manera sencilla, clara y con ejemplos prácticos todas las capas de seguridad implementadas en el sistema **PSI Aprende**. Explica qué riesgos mitiga cada mecanismo, cómo funciona técnicamente y cómo protege la información médica confidencial de los pacientes, familias y profesionales.

---

## 📑 Tabla de Contenidos

1. [¿Por qué es vital la seguridad en este sistema?](#1-por-qué-es-vital-la-seguridad-en-este-sistema)
2. [Capa 1: Contraseñas con Hashing Criptográfico (Bcrypt)](#capa-1-contraseñas-con-hashing-criptográfico-bcrypt)
3. [Capa 2: Protección contra Inyección SQL (Consultas Preparadas)](#capa-2-protección-contra-inyección-sql-consultas-preparadas)
4. [Capa 3: Autenticación con Tokens JWT y Expiración](#capa-3-autenticación-con-tokens-jwt-y-expiración)
5. [Capa 4: Control de Acceso Basado en Roles (RBAC)](#capa-4-control-de-acceso-basado-en-roles-rbac)
6. [Capa 5: Blindaje de Claves de API y Secretos (.env y Backend)](#capa-5-blindaje-de-claves-de-api-y-secretos-env-y-backend)
7. [Capa 6: Bitácora de Auditoría Inmutable (Trazabilidad Bioética)](#capa-6-bitácora-de-auditoría-inmutable-trazabilidad-bioética)
8. [Capa 7: Validez Legal y Firmas en Consentimientos Informados](#capa-7-validez-legal-y-firmas-en-consentimientos-informados)
9. [Capa 8: Custodia Bioética de Baterías Psicométricas (Regla RN-06)](#capa-8-custodia-bioética-de-baterías-psicométricas-regla-rn-06)
10. [Capa 9: Sanitización de Entradas y Límites de Carga (Anti-DoS)](#capa-9-sanitización-de-entradas-y-límites-de-carga-anti-dos)
11. [Capa 10: Anti-Espionaje en Caché y Política CORS](#capa-10-anti-espionaje-en-caché-y-política-cors)
12. [Capa 11: Cifrado en Tránsito (HTTPS / TLS)](#capa-11-cifrado-en-tránsito-https--tls)
13. [Matriz Resumen: Amenaza vs. Solución](#matriz-resumen-amenaza-vs-solución)

---

## 1. ¿Por qué es vital la seguridad en este sistema?

En una clínica de neurodesarrollo y psicología infantojuvenil no manejamos datos comunes; custodiamos información de **máxima sensibilidad**:
* Diagnósticos de salud mental infantil (TDAH, TEA, trastornos emocionales).
* Notas de evolución clínica confidenciales (SOAP).
* Datos personales de menores de edad y sus tutores legales (Ley 548 de Bolivia).
* Instrumentos psicométricos restringidos con derechos de autor.
* Movimientos financieros de honorarios y cobros por QR.

Por ello, el sistema aplica el principio de **Defensa en Profundidad**: si una barrera llegara a ser vulnerada, existen múltiples capas adicionales que impiden el acceso a los datos.

---

## Capa 1: Contraseñas con Hashing Criptográfico (Bcrypt)

### ¿Qué es y cómo funciona?
Nunca almacenamos las contraseñas reales de los usuarios. Cuando alguien crea una cuenta o cambia su clave, el backend utiliza el algoritmo **`bcryptjs`** con **10 rondas de salting aleatorio**.

* **Salting:** Se le añade a la contraseña una secuencia aleatoria única para que dos usuarios con la misma clave tengan resultados totalmente distintos.
* **Hashing irreversible:** La contraseña se transforma en una cadena matemática unidireccional. No existe una función para "desencriptar" el hash y volver a la clave original.

### ¿Contra qué nos protege?
* **Robo de base de datos:** Si un atacante robara el archivo de la base de datos, no podría ver ninguna contraseña en texto claro.
* **Ataques de diccionario / Tablas Arcoíris:** El *salt* vuelve inútiles los diccionarios de claves precalculadas.

### 💡 Ejemplo sencillo:
> **La analogía del pastel:**  
> Puedes hornear un pastel a partir de harina, huevos, azúcar y chocolate; pero una vez horneado, **es imposible separar los ingredientes para volver a tener los huevos o la harina intactos**.  
> Para verificar si la receta es correcta, el sistema toma la clave introducida en el login, le aplica la misma receta y compara si el "pastel resultante" es idéntico al guardado.

* **Contraseña escrita por el terapeuta:** `Clinica2026*!`
* **Lo que se guarda en la base de datos:**  
  `$2a$10$wK8rYgQ4vWp17X9sK3lMO.9xZJ4P1F9aUuOaP3eL7b5N6c3d8e2yG`

---

## Capa 2: Protección contra Inyección SQL (Consultas Preparadas)

### ¿Qué es y cómo funciona?
Todas las consultas a la base de datos utilizan **Sentencias Preparadas (Prepared Statements)** mediante el motor `better-sqlite3`. 

El código separa estrictamente la **orden SQL** de los **datos introducidos por el usuario** utilizando marcadores posicionales (`?`).

```javascript
// Código seguro implementado en el sistema:
const query = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1');
const user = query.get(emailIntroducido);
```

### ¿Contra qué nos protege?
* **Inyección SQL (SQLi):** Impide que atacantes manipulen formularios introduciendo fragmentos de código SQL para saltarse contraseñas, borrar tablas o extraer expedientes de pacientes.

### 💡 Ejemplo sencillo:
> Un atacante intenta entrar como administrador escribiendo en el campo de correo:  
> `' OR '1'='1`  
>
> ❌ **En un sistema vulnerable (sin protección):**  
> `SELECT * FROM usuarios WHERE email = '' OR '1'='1';`  
> *(El sistema devolvería al primer usuario de la base de datos porque 1=1 siempre es verdad, dándole acceso total).*
>
>  **En PSI Aprende (con protección):**  
> El sistema busca literalmente un usuario cuyo correo sea exactamente el texto `"' OR '1'='1"`. Al no existir nadie con ese correo literal, el intento es rechazado automáticamente.

---

## Capa 3: Autenticación con Tokens JWT y Expiración

### ¿Qué es y cómo funciona?
Cuando un usuario inicia sesión correctamente, el servidor genera un **JSON Web Token (JWT)** firmado criptográficamente con una clave secreta privada (`config.jwt.secret`).

* **Vigencia limitada:** Por seguridad clínica, cada token caduca automáticamente a las **8 horas** (`expiresIn: '8h'`).
* **Verificación continua:** Cada petición a la API valida que el token no haya sido alterado ni un solo carácter (`authMiddleware.js`).
* **Auto-purga:** Si el token expira o el usuario es desactivado en el sistema, el cliente web (`apiClient.js`) destruye la sesión y redirige inmediatamente al inicio de sesión.

### ¿Contra qué nos protege?
* **Suplantación de identidad:** Nadie puede falsificar un token sin conocer la clave secreta del servidor.
* **Sesiones olvidadas en consultorios:** Si un terapeuta deja la computadora encendida al terminar su jornada, la sesión se cierra sola para evitar accesos no autorizados.

### 💡 Ejemplo sencillo:
> **La analogía del pase VIP con sello notarial:**  
> El token es como una pulsera de acceso a un evento con fecha y hora grabadas con tinta invisible inviolable. Los guardias (middlewares) solo miran la pulsera. Si el sello está alterado o la hora ya pasó, no te dejan entrar y te cortan la pulsera.

---

## Capa 4: Control de Acceso Basado en Roles (RBAC)

### ¿Qué es y cómo funciona?
El sistema tiene definidos roles estrictos: **`ADMIN`**, **`TERAPEUTA`**, **`RECEPCION`**, **`TUTOR`**, entre otros. 

El middleware `requireRole` inspecciona el rol del usuario antes de permitir la ejecución de cualquier acción:

```javascript
// Ejemplo de protección de ruta:
router.post('/pacientes/eliminar', authMiddleware, requireRole(['ADMIN']), controller.delete);
```

### ¿Contra qué nos protege?
* **Escalada de privilegios:** Un usuario con rol de terapeuta no puede modificar honorarios globales ni crear usuarios.
* **Violación de privacidad cruzada:** Una secretaria no puede ver ni modificar las notas clínicas SOAP confidenciales de psicoterapia.
* **Fuga de datos de agenda:** Un terapeuta no puede modificar las citas privadas de otro especialista.

### 💡 Ejemplo sencillo:
> **La analogía de las llaves del hospital:**  
> Un recepcionista tiene llave para abrir el libro de visitas y la sala de espera, pero su llave física no abre la farmacia de medicamentos controlados ni el archivador de historias clínicas de psiquiatría.

---

## Capa 5: Blindaje de Claves de API y Secretos (.env y Backend)

### ¿Qué es y cómo funciona?
El sistema utiliza herramientas avanzadas como Inteligencia Artificial (**Groq API con LLaMA/Qwen**) y notificaciones web (**Web Push VAPID**).

* **Aislamiento en el servidor:** Las claves secretas viven exclusivamente en variables de entorno del backend (`process.env`) o en la base de datos interna.
* **El navegador jamás las ve:** El frontend nunca se comunica directamente con Groq ni tiene conocimiento de las claves. Siempre le pide la información al backend, y el backend responde.
* **Protección en Git:** El archivo `.env` está expresamente ignorado en `.gitignore` para que nunca se suba por error a repositorios públicos o privados.

### ¿Contra qué nos protege?
* **Robo de presupuesto y cuota de IA:** Si las claves se enviaran al navegador, cualquier usuario curioso podría abrir la consola de desarrollo (F12), copiar la clave de la clínica y usarla en sus propios programas gratis.
* **Envío de notificaciones falsas:** Impide que personas ajenas envíen notificaciones maliciosas a los celulares de los pacientes.

### 💡 Ejemplo sencillo:
> **La analogía de la ventanilla del banco:**  
> El cliente le pide al cajero: *"Deseo retirar 100 Bs"*. El cajero entra a la bóveda privada, toma el dinero y se lo entrega por la ventanilla. El cliente jamás entra a la bóveda ni sabe cuál es la combinación de la caja fuerte.

---

## Capa 6: Bitácora de Auditoría Inmutable (Trazabilidad Bioética)

### ¿Qué es y cómo funciona?
En la tabla `bitacora_auditoria` se registra automáticamente cada acción relevante realizada en el sistema:
* Quién realizó la acción (ID, nombre completo y rol).
* Dirección IP de origen y fecha/hora exacta.
* Módulo y detalle exacto del cambio.

### 🔒 Innovación de Seguridad: *Snapshots* Inmutables
Si un terapeuta es despedido o su cuenta es eliminada en el futuro, el registro histórico **no borra su nombre ni queda como un registro huérfano**. El sistema guarda una "fotografía congelada" (`usuario_nombre_snapshot`, `usuario_email_snapshot`, `rol_nombre_snapshot`) para que el historial médico conserve validez jurídica indefinidamente.

### ¿Contra qué nos protege?
* **Repudio (Negación de autoría):** Impide que alguien afirme *"yo no modifiqué esa historia clínica"* o *"yo no borré ese pago"*.
* **Auditorías legales y peritajes:** En caso de investigación forense o judicial, se cuenta con una línea de tiempo inalterable.

---

## Capa 7: Validez Legal y Firmas en Consentimientos Informados

### ¿Qué es y cómo funciona?
Para cumplir con la **Ley 548 (Código Niña, Niño y Adolescente de Bolivia)** y la bioética médica:
1. El tutor legal firma digitalmente en pantalla táctil o ratón.
2. La firma se almacena codificada como un trazo vectorial seguro (`firma_digital_blob`).
3. Se vincula al número de Cédula de Identidad (`firmado_por_ci`), parentesco, nombre completo, fecha/hora exacta, **dirección IP del firmante** y el **User-Agent** (dispositivo/navegador).
4. No se permite editar un consentimiento una vez firmado; solo admite revocación explícita con motivo fundamentado (`motivo_revocacion`).

### ¿Contra qué nos protege?
* **Demandas por mala praxis o falta de autorización:** Garantiza prueba fehaciente de que los padres autorizaron el tratamiento neurocognitivo o la telepsicología de sus hijos.

---

## Capa 8: Custodia Bioética de Baterías Psicométricas (Regla RN-06)

### ¿Qué es y cómo funciona?
Las pruebas psicológicas (WISC-V, ADOS-2, BANFE-2, etc.) tienen derechos de autor y su uso está legalmente restringido a psicólogos colegiados acreditados:
* **Préstamo controlado:** Cada vez que una batería sale de recepción a un consultorio, se registra el terapeuta receptor con su matrícula profesional (Colegio de Psicólogos de Bolivia), la sala asignada y la hora estimada de devolución.
* **Bloqueo de disponibilidad:** Ninguna batería puede prestarse dos veces a la vez ni desaparecer del inventario sin un responsable asignado.

### ¿Contra qué nos protege?
* **Pérdida o sustracción de material clínico costoso:** Baterías valoradas en miles de bolivianos.
* **Uso indebido de pruebas por personal no cualificado:** Protege a la clínica ante el Colegio de Psicólogos.

---

## Capa 9: Sanitización de Entradas y Límites de Carga (Anti-DoS)

### ¿Qué es y cómo funciona?
* **Límite de tamaño de peticiones:** El servidor limita el cuerpo de las peticiones a un máximo estricto de **10 MB** (`express.json({ limit: '10mb' })`).
* **Validación previa (DTOs):** Cada dato recibido se pasa por validadores estrictos (`validationMiddleware.js`): formatos de correo, teléfonos de Bolivia (8 dígitos válidos con prefijo 591), números positivos, etc.

### ¿Contra qué nos protege?
* **Ataques de agotamiento de memoria (Denial of Service - DoS):** Si un atacante intenta saturar la memoria RAM del servidor enviándole un archivo de texto de 500 MB en una petición JSON, el servidor rechaza la conexión antes de cargarla en memoria.
* **Corrupción de base de datos:** Evita registrar cadenas vacías, valores negativos en honorarios o teléfonos ficticios.

---

## Capa 10: Anti-Espionaje en Caché y Política CORS

### ¿Qué es y cómo funciona?
1. **Desactivación de Caché en Datos Médicos (`Cache-Control: no-store`):**  
   Todas las rutas de la API (`/api/*`) devuelven cabeceras HTTP que prohíben explícitamente al navegador guardar copias de las respuestas en el disco duro local:
   ```http
   Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
   Pragma: no-cache
   Expires: 0
   ```
2. **Control de Origen Cruzado (CORS):**  
   El backend únicamente acepta peticiones que provengan del dominio oficial del frontend o de herramientas autorizadas, bloqueando peticiones de páginas web desconocidas.

### ¿Contra qué nos protege?
* **Espionaje en computadoras compartidas:** Si un terapeuta cierra sesión en una computadora de la clínica, el siguiente usuario no podrá presionar el botón *"Atrás"* del navegador para ver los datos de los pacientes que se consultaron antes.

---

## Capa 11: Cifrado en Tránsito (HTTPS / TLS)

### ¿Cómo opera?
* **En desarrollo:** Corre sobre `http://localhost:3000` para agilizar las pruebas locales.
* **En producción (despliegue en la nube):** Se implementa mediante certificados SSL/TLS (Let's Encrypt o Cloudflare).
* **Preparación del sistema:** Todas las rutas, cabeceras y llamadas del frontend (`apiClient.js`) están diseñadas para funcionar sobre canales encriptados de extremo a extremo. De hecho, las **Notificaciones Push Web** y el soporte **PWA** ya activos en el sistema exigen obligatoriamente HTTPS para operar en dominios de internet.

### ¿Contra qué nos protege?
* **Ataques Man-in-the-Middle (Hombre en el medio):** Si alguien intercepta la red Wi-Fi de la clínica (por ejemplo, con un escáner de paquetes), solo verá datos cifrados indescifrables en lugar de nombres de pacientes, contraseñas o tokens.

---

## 📊 Matriz Resumen: Amenaza vs. Solución

| Amenaza o Riesgo Informático | Mecanismo de Seguridad en PSI Aprende | ¿Qué sucede si alguien lo intenta? |
| :--- | :--- | :--- |
| **Robo de base de datos** | Hash criptográfico `bcrypt` con 10 rondas de salt | Las contraseñas son ilegibles e irreversibles. |
| **Inyección de código en formularios** | Consultas Preparadas (`better-sqlite3`) | Los caracteres `'` o `--` se procesan como texto literal inocuo. |
| **Uso de sesión ajena o falsificada** | JWT con firma criptográfica y expiración a las 8h | Rechazo inmediato (Error 401 Unauthorized). |
| **Secretaria entrando a expedientes SOAP** | Control de Roles (RBAC con `requireRole`) | Acceso denegado (Error 403 Forbidden). |
| **Robo de saldo de Inteligencia Artificial** | Claves en `.env` en el servidor, jamás en cliente | El atacante no tiene acceso a las claves de Groq/LLaMA. |
| **Borrado de registros sin culpable** | Bitácora de auditoría con *snapshots* inmutables | Queda registrado el nombre, correo, rol, IP y hora exacta. |
| **Desconocimiento de consentimiento legal** | Firma digital en base64 con IP, CI y User-Agent | Documento con validez legal inalterable (Ley 548). |
| **Envío masivo de datos gigantes (DoS)** | Límite de carga de 10 MB en Express | Petición cortada de inmediato (Error 413 Payload Too Large). |
| **Ver datos clínicos con botón "Atrás"** | `Cache-Control: no-store` en todas las rutas `/api` | El navegador no guarda copias de expedientes en su caché. |
| **Intercepción de datos en red Wi-Fi** | Cifrado HTTPS / TLS 1.3 de extremo a extremo | Toda la información viaja 100% encriptada. |

---

> 📌 **Conclusión:**  
> El sistema cumple rigurosamente con los lineamientos internacionales de **OWASP Top 10** y las regulaciones bioéticas y legales de protección al menor, garantizando una plataforma robusta, confiable y segura para la práctica clínica diaria.
