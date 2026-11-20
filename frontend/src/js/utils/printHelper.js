/**
 * Utilidad universal de impresión aislada mediante Iframe invisible.
 * Garantiza:
 * 1. Cero páginas en blanco al inicio (la página 1 siempre es el documento).
 * 2. Independencia total del DOM de la SPA (#app no afecta el flujo de impresión).
 * 3. Formato estricto de 1 hoja con control exacto de márgenes y saltos de página.
 */
export function printIsolatedDocument({ title = 'Documento Oficial - PSI Aprende', contentHtml, styles = '' }) {
  let iframe = document.getElementById('psi-print-isolated-iframe');
  if (iframe) {
    iframe.remove();
  }

  iframe = document.createElement('iframe');
  iframe.id = 'psi-print-isolated-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '100vw';
  iframe.style.height = '100vh';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page {
          size: letter portrait;
          margin: 8mm 12mm 8mm 12mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          background: #FFFFFF;
          color: #1e293b;
          margin: 0;
          padding: 0;
          font-size: 8.5pt;
          line-height: 1.35;
        }
        div, table, section {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        img {
          object-fit: contain;
        }
        ${styles}
      </style>
    </head>
    <body>
      ${contentHtml}
    </body>
    </html>
  `);
  doc.close();

  // Esperar a que se procese el renderizado interno antes de invocar print
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 250);
}
