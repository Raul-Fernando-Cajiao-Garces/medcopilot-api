import { DomainError } from '../../../shared/domain/errors/DomainError.js';

export interface Patient {
  id: number;
  documentId: string;
  fullName: string;
  allergies: string;
  metabolicProfile: string;
}

export interface CreatePatientData {
  documentId: string;
  fullName: string;
  allergies?: string;
  metabolicProfile?: string;
}

export const validatePatientData = (data: CreatePatientData): void => {
  if (!data.documentId || data.documentId.trim().length < 5) {
    throw new DomainError('El documento de identidad debe tener al menos 5 caracteres.');
  }

  if (!data.fullName || data.fullName.trim().length < 3) {
    throw new DomainError('El nombre completo del paciente debe tener al menos 3 caracteres.');
  }
};
