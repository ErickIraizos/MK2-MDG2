import { IRoomRepository } from '../../domain/interfaces/IRoomRepository.js';
import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresRoomRepository extends IRoomRepository {
  async findAll(includeInactive = false) {
    const query = `
      SELECT id, codigo, nombre, tipo, descripcion, capacidad, color_identificador, activo, created_at
      FROM ambientes
      ${includeInactive ? '' : 'WHERE activo = 1'}
      ORDER BY id ASC
    `;
    const { rows } = await PostgresConnection.query(query);
    return rows;
  }

  async findById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT id, codigo, nombre, tipo, descripcion, capacidad, color_identificador, activo, created_at
       FROM ambientes
       WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async findByCode(code) {
    const { rows } = await PostgresConnection.query(
      `SELECT id, codigo, nombre, tipo, descripcion, capacidad, color_identificador, activo, created_at
       FROM ambientes
       WHERE codigo = $1`,
      [code]
    );
    return rows[0] || null;
  }

  async create(roomData) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO ambientes (codigo, nombre, tipo, descripcion, capacidad, color_identificador, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        roomData.codigo.trim().toUpperCase(),
        roomData.nombre.trim(),
        roomData.tipo ? roomData.tipo.trim() : 'INTEGRAL_CONDUCTUAL',
        roomData.descripcion ? roomData.descripcion.trim() : null,
        roomData.capacidad ? Number(roomData.capacidad) : 4,
        roomData.color_identificador || '#2563eb',
        roomData.activo !== undefined ? (roomData.activo ? 1 : 0) : 1
      ]
    );
    return this.findById(rows[0].id);
  }

  async update(id, roomData) {
    const fields = [];
    const values = [];

    if (roomData.codigo !== undefined) {
      values.push(roomData.codigo.trim().toUpperCase());
      fields.push(`codigo = $${values.length}`);
    }
    if (roomData.nombre !== undefined) {
      values.push(roomData.nombre.trim());
      fields.push(`nombre = $${values.length}`);
    }
    if (roomData.tipo !== undefined) {
      values.push(roomData.tipo.trim());
      fields.push(`tipo = $${values.length}`);
    }
    if (roomData.descripcion !== undefined) {
      values.push(roomData.descripcion);
      fields.push(`descripcion = $${values.length}`);
    }
    if (roomData.capacidad !== undefined) {
      values.push(Number(roomData.capacidad));
      fields.push(`capacidad = $${values.length}`);
    }
    if (roomData.color_identificador !== undefined) {
      values.push(roomData.color_identificador);
      fields.push(`color_identificador = $${values.length}`);
    }
    if (roomData.activo !== undefined) {
      values.push(roomData.activo ? 1 : 0);
      fields.push(`activo = $${values.length}`);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await PostgresConnection.query(
      `UPDATE ambientes SET ${fields.join(', ')} WHERE id = $${values.length}`,
      values
    );

    return this.findById(id);
  }

  async delete(id) {
    const res = await PostgresConnection.query('DELETE FROM ambientes WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  async getOccupancySummary() {
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
    const { rows } = await PostgresConnection.query(
      `SELECT id, nombre, descripcion, duracion_minutos, arancel_bob
       FROM servicios_aranceles
       WHERE activo = 1
       ORDER BY id ASC`
    );
    return rows;
  }
}
