import { IRoomRepository } from '../../domain/interfaces/IRoomRepository.js';
import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteRoomRepository extends IRoomRepository {
  constructor(db = DatabaseConnection.getInstance()) {
    super();
    this.db = db;
  }

  async findAll(includeInactive = false) {
    const query = `
      SELECT id, codigo, nombre, tipo, descripcion, capacidad, color_identificador, activo, created_at
      FROM ambientes
      ${includeInactive ? '' : 'WHERE activo = 1'}
      ORDER BY id ASC
    `;
    return this.db.prepare(query).all();
  }

  async findById(id) {
    const stmt = this.db.prepare(`
      SELECT id, codigo, nombre, tipo, descripcion, capacidad, color_identificador, activo, created_at
      FROM ambientes
      WHERE id = ?
    `);
    return stmt.get(id) || null;
  }

  async findByCode(code) {
    const stmt = this.db.prepare(`
      SELECT id, codigo, nombre, tipo, descripcion, capacidad, color_identificador, activo, created_at
      FROM ambientes
      WHERE codigo = ?
    `);
    return stmt.get(code) || null;
  }

  async create(roomData) {
    const stmt = this.db.prepare(`
      INSERT INTO ambientes (codigo, nombre, tipo, descripcion, capacidad, color_identificador, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      roomData.codigo.trim().toUpperCase(),
      roomData.nombre.trim(),
      roomData.tipo ? roomData.tipo.trim() : 'INTEGRAL_CONDUCTUAL',
      roomData.descripcion ? roomData.descripcion.trim() : null,
      roomData.capacidad ? Number(roomData.capacidad) : 4,
      roomData.color_identificador || '#2563eb',
      roomData.activo !== undefined ? (roomData.activo ? 1 : 0) : 1
    );
    return this.findById(info.lastInsertRowid);
  }

  async update(id, roomData) {
    const fields = [];
    const values = [];

    if (roomData.codigo !== undefined) {
      fields.push('codigo = ?');
      values.push(roomData.codigo.trim().toUpperCase());
    }
    if (roomData.nombre !== undefined) {
      fields.push('nombre = ?');
      values.push(roomData.nombre.trim());
    }
    if (roomData.tipo !== undefined) {
      fields.push('tipo = ?');
      values.push(roomData.tipo.trim());
    }
    if (roomData.descripcion !== undefined) {
      fields.push('descripcion = ?');
      values.push(roomData.descripcion);
    }
    if (roomData.capacidad !== undefined) {
      fields.push('capacidad = ?');
      values.push(Number(roomData.capacidad));
    }
    if (roomData.color_identificador !== undefined) {
      fields.push('color_identificador = ?');
      values.push(roomData.color_identificador);
    }
    if (roomData.activo !== undefined) {
      fields.push('activo = ?');
      values.push(roomData.activo ? 1 : 0);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const sql = `UPDATE ambientes SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);

    return this.findById(id);
  }

  async delete(id) {
    const stmt = this.db.prepare('DELETE FROM ambientes WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  async getOccupancySummary() {
    // Devuelve la lista de las salas/consultorios y su estado operativo
    const rooms = await this.findAll(true);
    return rooms.map(room => ({
      id: room.id,
      codigo: room.codigo,
      nombre: room.nombre,
      tipo: room.tipo,
      color: room.color_identificador,
      activo: room.activo === 1,
      estado_actual: room.activo === 1 ? 'DISPONIBLE' : 'EN_MANTENIMIENTO'
    }));
  }

  async getActiveServices() {
    return this.db.prepare(`
      SELECT id, nombre, descripcion, duracion_minutos, arancel_bob
      FROM servicios_aranceles
      WHERE activo = 1
      ORDER BY id ASC
    `).all();
  }
}
