import { RepositoryFactory } from '../core/RepositoryFactory.js';

const CATEGORY_NAMES = {
  RULES: 'Códigos & Reglas del Centro',
  SOAP: 'Metodología SOAP & PTI',
  MANUALS: 'Manuales & Diagnósticos',
  TESTS: 'Pruebas & Baremos',
  STUDIES: 'Estudios Externos',
  SPECIALTIES: 'Especialidades Clínicas',
  LEGAL: 'Normativa & Bioética',
  TECH_BILLING: 'Caja, Pagos, Alianzas & IA'
};

export class GlossaryService {
  constructor() {
    this.repo = RepositoryFactory.getGlossaryRepository();
  }

  async getAllTerms(filters = {}) {
    return this.repo.getAllTerms(filters);
  }

  async getTermById(id) {
    const term = await this.repo.getTermById(id);
    if (!term) throw new Error('Término no encontrado en el glosario institucional');
    return term;
  }

  async createTerm(data, user) {
    if (!data.title || !data.title.trim()) {
      throw new Error('El nombre o sigla del término es obligatorio.');
    }
    if (!data.que_es || !data.que_es.trim()) {
      throw new Error('La explicación sencilla "¿Qué es?" es obligatoria.');
    }
    if (!data.aplicacion || !data.aplicacion.trim()) {
      throw new Error('La sección "¿Cómo se aplica en PSI Aprende?" es obligatoria.');
    }

    const category = data.category || 'RULES';
    const category_name = data.category_name || CATEGORY_NAMES[category] || 'General';
    const autor = user ? `${user.nombre || user.email}` : 'Equipo PSI Aprende';

    return this.repo.createTerm({
      ...data,
      category,
      category_name,
      autor
    });
  }

  async updateTerm(id, data, user) {
    const existing = await this.repo.getTermById(id);
    if (!existing) throw new Error('El término que intenta actualizar no existe.');

    const category = data.category || existing.category;
    const category_name = data.category_name || CATEGORY_NAMES[category] || existing.category_name;
    const autor = user ? `${user.nombre || user.email}` : existing.autor;

    return this.repo.updateTerm(id, {
      ...data,
      category,
      category_name,
      autor
    });
  }

  async deactivateTerm(id) {
    const existing = await this.repo.getTermById(id);
    if (!existing) throw new Error('El término que intenta desactivar no existe.');
    return this.repo.setTermStatus(id, 0);
  }

  async reactivateTerm(id) {
    const existing = await this.repo.getTermById(id);
    if (!existing) throw new Error('El término que intenta reactivar no existe.');
    return this.repo.setTermStatus(id, 1);
  }

  // En caso de que se invoque deleteTerm, se protege aplicando soft-delete (inactivo)
  async deleteTerm(id) {
    return this.deactivateTerm(id);
  }
}
