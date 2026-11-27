import { DomainError } from '../../../shared/domain/errors/DomainError.js';

export type TriagePriority = 'NORMAL' | 'URGENT';

export interface Consultation {
  id: number;
  patientId: number;
  doctorId: number;
  patientName?: string;
  patientAllergies?: string;
  patientMetabolicProfile?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  symptoms: string;
  temperature: number;
  painLevel: number;
  proposedIndications: string;
  triagePriority: TriagePriority;
  metabolicAlerts: string;
  ragContext: string;
  soapDraft: string;
  symptomVector: string;
  doctorNotes: string;
  validatedByDoctor: boolean;
  createdAt: Date;
}

export interface CreateConsultationInput {
  patientId: number;
  doctorId: number;
  symptoms: string;
  temperature: number;
  painLevel: number;
  proposedIndications?: string;
  doctorNotes?: string;
}

export interface UpdateConsultationData {
  doctorNotes?: string;
  soapDraft?: string;
  validatedByDoctor?: boolean;
}

export const validateCreateConsultationInput = (input: CreateConsultationInput): void => {
  if (!input.patientId || Number.isNaN(input.patientId) || input.patientId <= 0) {
    throw new DomainError('El identificador del paciente debe ser un número entero válido.');
  }

  if (!input.doctorId || Number.isNaN(input.doctorId) || input.doctorId <= 0) {
    throw new DomainError('El identificador del médico debe ser un número entero válido.');
  }

  if (!input.symptoms || input.symptoms.trim().length < 5) {
    throw new DomainError('La descripción de síntomas debe contener al menos 5 caracteres.');
  }

  if (
    input.temperature === undefined ||
    input.temperature === null ||
    Number.isNaN(input.temperature) ||
    input.temperature < 34 ||
    input.temperature > 43
  ) {
    throw new DomainError('La temperatura corporal debe situarse en un rango clínico creíble (34.0°C a 43.0°C).');
  }

  if (
    input.painLevel === undefined ||
    input.painLevel === null ||
    Number.isNaN(input.painLevel) ||
    input.painLevel < 0 ||
    input.painLevel > 10
  ) {
    throw new DomainError('La escala de dolor EVA debe ser un número entero entre 0 y 10.');
  }
};
