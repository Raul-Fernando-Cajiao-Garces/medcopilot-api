import { DomainError } from '../../../shared/domain/errors/DomainError.js';

export interface Doctor {
  id: number;
  fullName: string;
  specialty: string;
  licenseCode: string;
}

export interface CreateDoctorData {
  fullName: string;
  specialty: string;
  licenseCode: string;
}

export const validateDoctorData = (data: CreateDoctorData): void => {
  if (!data.fullName || data.fullName.trim().length < 3) {
    throw new DomainError('El nombre completo del médico debe tener al menos 3 caracteres.');
  }

  if (!data.specialty || data.specialty.trim().length === 0) {
    throw new DomainError('La especialidad médica es obligatoria.');
  }

  if (!data.licenseCode || data.licenseCode.trim().length < 4) {
    throw new DomainError('El código de licencia médica debe tener al menos 4 caracteres.');
  }
};
