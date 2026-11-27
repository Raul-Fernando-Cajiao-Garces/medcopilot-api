import type { Pool } from 'pg';
import type { Doctor, CreateDoctorData } from '../../domain/Doctor.js';
import type { DoctorRepository } from '../../ports/DoctorRepository.js';

interface DoctorRow {
  id: number;
  full_name: string;
  specialty: string;
  license_code: string;
}

const mapRowToDoctor = (row: DoctorRow): Doctor => ({
  id: row.id,
  fullName: row.full_name,
  specialty: row.specialty,
  licenseCode: row.license_code,
});

export const createPostgresDoctorRepository = (pool: Pool): DoctorRepository => {
  const create = async (data: CreateDoctorData): Promise<Doctor> => {
    const query = `
      INSERT INTO doctors (full_name, specialty, license_code)
      VALUES ($1, $2, $3)
      RETURNING id, full_name, specialty, license_code
    `;
    const result = await pool.query<DoctorRow>(query, [
      data.fullName,
      data.specialty,
      data.licenseCode,
    ]);

    const row = result.rows[0];
    if (!row) {
      throw new Error('Error al registrar el médico en PostgreSQL.');
    }
    return mapRowToDoctor(row);
  };

  const findAll = async (): Promise<Doctor[]> => {
    const query = `
      SELECT id, full_name, specialty, license_code
      FROM doctors
      ORDER BY id ASC
    `;
    const result = await pool.query<DoctorRow>(query);
    return result.rows.map(mapRowToDoctor);
  };

  const findById = async (id: number): Promise<Doctor | null> => {
    const query = `
      SELECT id, full_name, specialty, license_code
      FROM doctors
      WHERE id = $1
    `;
    const result = await pool.query<DoctorRow>(query, [id]);
    const row = result.rows[0];
    return row ? mapRowToDoctor(row) : null;
  };

  const findByLicenseCode = async (licenseCode: string): Promise<Doctor | null> => {
    const query = `
      SELECT id, full_name, specialty, license_code
      FROM doctors
      WHERE LOWER(license_code) = LOWER($1)
    `;
    const result = await pool.query<DoctorRow>(query, [licenseCode]);
    const row = result.rows[0];
    return row ? mapRowToDoctor(row) : null;
  };

  return {
    create,
    findAll,
    findById,
    findByLicenseCode,
  };
};
