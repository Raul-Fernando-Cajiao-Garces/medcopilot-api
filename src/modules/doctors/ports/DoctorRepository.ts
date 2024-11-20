import type { Doctor, CreateDoctorData } from '../domain/Doctor.js';

export interface DoctorRepository {
  create: (data: CreateDoctorData) => Promise<Doctor>;
  findAll: () => Promise<Doctor[]>;
  findById: (id: number) => Promise<Doctor | null>;
  findByLicenseCode: (licenseCode: string) => Promise<Doctor | null>;
}
