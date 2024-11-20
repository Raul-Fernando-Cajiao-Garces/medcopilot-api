import type { Doctor, CreateDoctorData } from '../../domain/Doctor.js';
import type { DoctorRepository } from '../../ports/DoctorRepository.js';

export const createInMemoryDoctorRepository = (initialDoctors: Doctor[] = []): DoctorRepository => {
  const doctors: Doctor[] = [...initialDoctors];
  let nextId = doctors.reduce((max, d) => Math.max(max, d.id), 0) + 1;

  const create = async (data: CreateDoctorData): Promise<Doctor> => {
    const newDoctor: Doctor = {
      id: nextId++,
      fullName: data.fullName,
      specialty: data.specialty,
      licenseCode: data.licenseCode,
    };
    doctors.push(newDoctor);
    return { ...newDoctor };
  };

  const findAll = async (): Promise<Doctor[]> => {
    return doctors.map((d) => ({ ...d }));
  };

  const findById = async (id: number): Promise<Doctor | null> => {
    const found = doctors.find((d) => d.id === id);
    return found ? { ...found } : null;
  };

  const findByLicenseCode = async (licenseCode: string): Promise<Doctor | null> => {
    const found = doctors.find(
      (d) => d.licenseCode.toLowerCase() === licenseCode.toLowerCase()
    );
    return found ? { ...found } : null;
  };

  return {
    create,
    findAll,
    findById,
    findByLicenseCode,
  };
};
