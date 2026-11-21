/**
 * Configuracion de PM2 para produccion en AWS EC2 (Ubuntu).
 *
 * IMPORTANTE:
 * - Mantener instances: 1 y exec_mode: 'fork' (no usar cluster) porque whatsapp-web.js
 *   gestiona sesiones Chromium exclusivas en .wwebjs_auth/ y appointmentSchedulerService.js
 *   ejecuta recordatorios periodicos en memoria.
 * - Mantener watch: false para evitar reinicios por escrituras de sesion de WhatsApp.
 */
module.exports = {
  apps: [
    {
      name: 'psi-aprende-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
