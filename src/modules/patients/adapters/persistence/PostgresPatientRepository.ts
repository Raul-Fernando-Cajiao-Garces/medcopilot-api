import type { Pool } from 'pg';
import type { Patient, CreatePatientData } from '../../domain/Patient.js';
import type { PatientRepository } from '../../ports/PatientRepository.js';

interface PatientRow {
  id: number;
  document_id: string;
  full_name: string;
  allergies: string;
  metabolic_profile: string;
}

const mapRowToPatient = (row: PatientRow): Patient => ({
  id: row.id,
  documentId: row.document_id,
  fullName: row.full_name,
  allergies: row.allergies,
  metabolicProfile: row.metabolic_profile,
});

export const createPostgresPatientRepository = (pool: Pool): PatientRepository => {
  const create = async (data: CreatePatientData): Promise<Patient> => {
    const query = `
      INSERT INTO patients (document_id, full_name, allergies, metabolic_profile)
      VALUES ($1, $2, $3, $4)
      RETURNING id, document_id, full_name, allergies, metabolic_profile
    `;
    const result = await pool.query<PatientRow>(query, [
      data.documentId,
      data.fullName,
      data.allergies ?? 'Ninguna',
      data.metabolicProfile ?? 'Sin antecedentes metabólicos',
    ]);

    const row = result.rows[0];
    if (!row) {
      throw new Error('Error al registrar el paciente en PostgreSQL.');
    }
    return mapRowToPatient(row);
  };

  const findAll = async (): Promise<Patient[]> => {
    const query = `
      SELECT id, document_id, full_name, allergies, metabolic_profile
      FROM patients
      ORDER BY id ASC
    `;
    const result = await pool.query<PatientRow>(query);
    return result.rows.map(mapRowToPatient);
  };

  const findById = async (id: number): Promise<Patient | null> => {
    const query = `
      SELECT id, document_id, full_name, allergies, metabolic_profile
      FROM patients
      WHERE id = $1
    `;
    const result = await pool.query<PatientRow>(query, [id]);
    const row = result.rows[0];
    return row ? mapRowToPatient(row) : null;
  };

  const findByDocumentId = async (documentId: string): Promise<Patient | null> => {
    const query = `
      SELECT id, document_id, full_name, allergies, metabolic_profile
      FROM patients
      WHERE LOWER(document_id) = LOWER($1)
    `;
    const result = await pool.query<PatientRow>(query, [documentId]);
    const row = result.rows[0];
    return row ? mapRowToPatient(row) : null;
  };

  return {
    create,
    findAll,
    findById,
    findByDocumentId,
  };
};
