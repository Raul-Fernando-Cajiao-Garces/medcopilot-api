import type { Patient, CreatePatientData } from '../domain/Patient.js';
import { validatePatientData } from '../domain/Patient.js';
import type { PatientRepository } from '../ports/PatientRepository.js';
import { DomainError } from '../../../shared/domain/errors/DomainError.js';
import { NotFoundError } from '../../../shared/domain/errors/NotFoundError.js';

export interface PatientService {
  create: (data: CreatePatientData) => Promise<Patient>;
  getAll: () => Promise<Patient[]>;
  getById: (id: number) => Promise<Patient>;
}

export const createPatientService = (repository: PatientRepository): PatientService => {
  const create = async (data: CreatePatientData): Promise<Patient> => {
    validatePatientData(data);

    const existing = await repository.findByDocumentId(data.documentId.trim());
    if (existing) {
      throw new DomainError('Ya existe un paciente registrado con este documento de identidad.');
    }

    return repository.create({
      documentId: data.documentId.trim(),
      fullName: data.fullName.trim(),
      allergies: data.allergies?.trim() || 'Ninguna',
      metabolicProfile: data.metabolicProfile?.trim() || 'Sin antecedentes metabólicos',
    });
  };

  const getAll = async (): Promise<Patient[]> => {
    return repository.findAll();
  };

  const getById = async (id: number): Promise<Patient> => {
    if (Number.isNaN(id) || id <= 0) {
      throw new DomainError('El identificador del paciente debe ser un número entero positivo.');
    }

    const patient = await repository.findById(id);
    if (!patient) {
      throw new NotFoundError(`No se encontró ningún paciente con el identificador ${id}.`);
    }

    return patient;
  };

  return {
    create,
    getAll,
    getById,
  };
};
