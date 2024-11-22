import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryDoctorRepository } from '../../src/modules/doctors/adapters/persistence/InMemoryDoctorRepository.js';
import { createDoctorService } from '../../src/modules/doctors/application/DoctorService.js';
import type { DoctorService } from '../../src/modules/doctors/application/DoctorService.js';
import { DomainError } from '../../src/shared/domain/errors/DomainError.js';
import { NotFoundError } from '../../src/shared/domain/errors/NotFoundError.js';

describe('DoctorService (Unit Tests)', () => {
  let service: DoctorService;

  beforeEach(() => {
    const repository = createInMemoryDoctorRepository();
    service = createDoctorService(repository);
  });

  // Test 1: Creación válida
  it('debe registrar un médico válidamente', async () => {
    const doctor = await service.create({
      fullName: 'Dr. Alejandro Morales',
      specialty: 'Cardiología Clínica',
      licenseCode: 'CARD-1002',
    });

    expect(doctor.id).toBeGreaterThan(0);
    expect(doctor.fullName).toBe('Dr. Alejandro Morales');
    expect(doctor.specialty).toBe('Cardiología Clínica');
    expect(doctor.licenseCode).toBe('CARD-1002');
  });

  // Test 2: Listado de médicos
  it('debe listar todos los médicos registrados', async () => {
    await service.create({
      fullName: 'Dra. Patricia Ortiz',
      specialty: 'Pediatría',
      licenseCode: 'PED-4001',
    });
    await service.create({
      fullName: 'Dr. Daniel Silva',
      specialty: 'Traumatología',
      licenseCode: 'TRAU-5002',
    });

    const doctors = await service.getAll();
    expect(doctors).toHaveLength(2);
    expect(doctors[0]?.fullName).toBe('Dra. Patricia Ortiz');
    expect(doctors[1]?.fullName).toBe('Dr. Daniel Silva');
  });

  // Test 3: Consulta por ID existente
  it('debe encontrar un médico por su identificador ID', async () => {
    const created = await service.create({
      fullName: 'Dr. Roberto Mendoza',
      specialty: 'Neurología',
      licenseCode: 'NEUR-9911',
    });

    const found = await service.getById(created.id);
    expect(found.id).toBe(created.id);
    expect(found.fullName).toBe('Dr. Roberto Mendoza');
  });

  // Test 4: NotFoundError por ID inexistente
  it('debe lanzar NotFoundError cuando el ID del médico no existe', async () => {
    await expect(service.getById(999)).rejects.toThrow(NotFoundError);
    await expect(service.getById(999)).rejects.toThrow(
      'No se encontró ningún médico con el identificador 999.'
    );
  });

  // Test 5: DomainError por nombre corto o vacío
  it('debe lanzar DomainError si el nombre tiene menos de 3 caracteres', async () => {
    await expect(
      service.create({
        fullName: 'Dr',
        specialty: 'Nefrología',
        licenseCode: 'NEF-1234',
      })
    ).rejects.toThrow(DomainError);

    await expect(
      service.create({
        fullName: '  ',
        specialty: 'Nefrología',
        licenseCode: 'NEF-1234',
      })
    ).rejects.toThrow('El nombre completo del médico debe tener al menos 3 caracteres.');
  });

  // Test 6: DomainError por especialidad vacía
  it('debe lanzar DomainError si la especialidad médica está vacía', async () => {
    await expect(
      service.create({
        fullName: 'Dr. Gabriel Torres',
        specialty: '   ',
        licenseCode: 'GEN-5544',
      })
    ).rejects.toThrow(DomainError);

    await expect(
      service.create({
        fullName: 'Dr. Gabriel Torres',
        specialty: '',
        licenseCode: 'GEN-5544',
      })
    ).rejects.toThrow('La especialidad médica es obligatoria.');
  });

  // Test 7: DomainError por código de licencia inválido
  it('debe lanzar DomainError si el código de licencia tiene menos de 4 caracteres', async () => {
    await expect(
      service.create({
        fullName: 'Dr. Javier Castro',
        specialty: 'Oftalmología',
        licenseCode: 'OFT',
      })
    ).rejects.toThrow('El código de licencia médica debe tener al menos 4 caracteres.');
  });

  // Test 8: DomainError por código de licencia duplicado
  it('debe rechazar con DomainError el registro de un médico con licencia duplicada', async () => {
    await service.create({
      fullName: 'Dra. Mónica Rosales',
      specialty: 'Ginecología',
      licenseCode: 'GIN-7788',
    });

    await expect(
      service.create({
        fullName: 'Dra. Mónica Rosales Clon',
        specialty: 'Obstetricia',
        licenseCode: 'GIN-7788',
      })
    ).rejects.toThrow('Ya existe un médico registrado con este código de licencia médica.');
  });
});
