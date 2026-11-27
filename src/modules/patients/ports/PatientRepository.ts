import type { Patient, CreatePatientData } from '../domain/Patient.js';

export interface PatientRepository {
  create: (data: CreatePatientData) => Promise<Patient>;
  findAll: () => Promise<Patient[]>;
  findById: (id: number) => Promise<Patient | null>;
  findByDocumentId: (documentId: string) => Promise<Patient | null>;
}
