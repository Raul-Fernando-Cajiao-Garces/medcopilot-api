import type { Patient, CreatePatientData } from '../../domain/Patient.js';
import type { PatientRepository } from '../../ports/PatientRepository.js';

export const createInMemoryPatientRepository = (
  initialPatients: Patient[] = []
): PatientRepository => {
  const patients: Patient[] = [...initialPatients];
  let nextId = patients.reduce((max, p) => Math.max(max, p.id), 0) + 1;

  const create = async (data: CreatePatientData): Promise<Patient> => {
    const newPatient: Patient = {
      id: nextId++,
      documentId: data.documentId,
      fullName: data.fullName,
      allergies: data.allergies ?? 'Ninguna',
      metabolicProfile: data.metabolicProfile ?? 'Sin antecedentes metabólicos',
    };
    patients.push(newPatient);
    return { ...newPatient };
  };

  const findAll = async (): Promise<Patient[]> => {
    return patients.map((p) => ({ ...p }));
  };

  const findById = async (id: number): Promise<Patient | null> => {
    const found = patients.find((p) => p.id === id);
    return found ? { ...found } : null;
  };

  const findByDocumentId = async (documentId: string): Promise<Patient | null> => {
    const found = patients.find(
      (p) => p.documentId.toLowerCase() === documentId.toLowerCase()
    );
    return found ? { ...found } : null;
  };

  return {
    create,
    findAll,
    findById,
    findByDocumentId,
  };
};
