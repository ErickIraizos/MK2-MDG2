import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createSamplePdf(filePath, title, bodyText) {
  const content = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 280 >> stream
BT
/F1 15 Tf
50 720 Td
(${title}) Tj
/F1 10 Tf
0 -30 Td
(${bodyText}) Tj
0 -20 Td
(Centro Psicopedagogico PSI Aprende - Cochabamba, Bolivia) Tj
0 -20 Td
(Documento digitalizado para custodia clinica confidencial) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000580 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
650
%%EOF`;
  fs.writeFileSync(filePath, content.trim());
}

const dir = path.resolve(__dirname, '..', '..', 'uploads', 'patient_documents');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

createSamplePdf(path.join(dir, 'doc_eeg_mateo_fuentes_seed_2026.pdf'), 'ELECTROENCEFALOGRAMA DIGITAL DE VIGILIA', 'Paciente: Mateo Fuentes Rocha - Edad: 8 anos. Conclusiones: Trazado dentro de limites normales.');
createSamplePdf(path.join(dir, 'doc_informe_colegio_mateo_seed_2026.pdf'), 'INFORME DE GABINETE PSICOPEDAGOGICO ESCOLAR', 'Colegio La Salle. Informe de adaptaciones atencionales y conducta en aula.');
createSamplePdf(path.join(dir, 'doc_tac_cerebral_gonzalo_seed_2026.pdf'), 'TOMOGRAFIA AXIAL COMPUTARIZADA TAC CEREBRAL', 'Paciente: Gonzalo Bustamante - Conclusiones: Leve atrofia cortical acorde a la edad.');

console.log('Sample seed PDFs generated successfully at:', dir);

