import { Icons } from './Icons.js';
import { escapeHtml } from '../utils/sanitize.js';

export class Toast {
  static show(message, type = 'info', duration = 4500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = Icons.info(18, 'var(--soft-purple-primary)');
    let titleText = 'Información Clínica';

    if (type === 'success') {
      iconSvg = Icons.checkCircle(18, '#059669');
      titleText = 'Acción Exitosa';
    } else if (type === 'error') {
      iconSvg = Icons.alert(18, '#DC2626');
      titleText = 'Aviso del Sistema';
    } else if (type === 'warning') {
      iconSvg = Icons.alert(18, '#D97706');
      titleText = 'Atención Clínica';
    }

    toast.innerHTML = `
      <div class="toast-icon-wrapper">
        ${iconSvg}
      </div>
      <div class="toast-content">
        <div class="toast-title">${titleText}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" type="button" aria-label="Cerrar notificación">
        ${Icons.close(13)}
      </button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      Toast.remove(toast);
    });

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        Toast.remove(toast);
      }, duration);
    }
  }

  static success(message, duration = 4000) {
    Toast.show(message, 'success', duration);
  }

  static error(message, duration = 5000) {
    Toast.show(message, 'error', duration);
  }

  static warning(message, duration = 4500) {
    Toast.show(message, 'warning', duration);
  }

  static info(message, duration = 4000) {
    Toast.show(message, 'info', duration);
  }

  static remove(toast) {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 280);
  }
}
