import type { Doctor, CreateDoctorData } from '../domain/Doctor.js';
import { validateDoctorData } from '../domain/Doctor.js';
import type { DoctorRepository } from '../ports/DoctorRepository.js';
import { DomainError } from '../../../shared/domain/errors/DomainError.js';
import { NotFoundError } from '../../../shared/domain/errors/NotFoundError.js';

export interface DoctorService {
  create: (data: CreateDoctorData) => Promise<Doctor>;
  getAll: () => Promise<Doctor[]>;
  getById: (id: number) => Promise<Doctor>;
}

export const createDoctorService = (repository: DoctorRepository): DoctorService => {
  const create = async (data: CreateDoctorData): Promise<Doctor> => {
    validateDoctorData(data);

    const existing = await repository.findByLicenseCode(data.licenseCode.trim());
    if (existing) {
      throw new DomainError('Ya existe un médico registrado con este código de licencia médica.');
    }

    return repository.create({
      fullName: data.fullName.trim(),
      specialty: data.specialty.trim(),
      licenseCode: data.licenseCode.trim(),
    });
  };

  const getAll = async (): Promise<Doctor[]> => {
    return repository.findAll();
  };

  const getById = async (id: number): Promise<Doctor> => {
    if (Number.isNaN(id) || id <= 0) {
      throw new DomainError('El identificador del médico debe ser un número entero positivo.');
    }

    const doctor = await repository.findById(id);
    if (!doctor) {
      throw new NotFoundError(`No se encontró ningún médico con el identificador ${id}.`);
    }

    return doctor;
  };

  return {
    create,
    getAll,
    getById,
  };
};
