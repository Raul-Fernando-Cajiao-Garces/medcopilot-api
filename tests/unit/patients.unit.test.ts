import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryPatientRepository } from '../../src/modules/patients/adapters/persistence/InMemoryPatientRepository.js';
import { createPatientService } from '../../src/modules/patients/application/PatientService.js';
import type { PatientService } from '../../src/modules/patients/application/PatientService.js';
import { DomainError } from '../../src/shared/domain/errors/DomainError.js';
import { NotFoundError } from '../../src/shared/domain/errors/NotFoundError.js';

describe('PatientService (Unit Tests)', () => {
  let service: PatientService;

  beforeEach(() => {
    const repository = createInMemoryPatientRepository();
    service = createPatientService(repository);
  });

  // Test 1: Creación válida de paciente con datos clínicos
  it('debe registrar un paciente con antecedentes clínicos y alergias', async () => {
    const patient = await service.create({
      documentId: '1722334455',
      fullName: 'Andrés Suárez Mora',
      allergies: 'Penicilina',
      metabolicProfile: 'Esteatosis hepática no alcohólica leve',
    });

    expect(patient.id).toBeGreaterThan(0);
    expect(patient.documentId).toBe('1722334455');
    expect(patient.fullName).toBe('Andrés Suárez Mora');
    expect(patient.allergies).toBe('Penicilina');
    expect(patient.metabolicProfile).toBe('Esteatosis hepática no alcohólica leve');
  });

  // Test 2: Valores por defecto cuando no se envían alergias o perfil
  it('debe asignar valores por defecto a alergias y perfil metabólico si se omiten', async () => {
    const patient = await service.create({
      documentId: '1799887766',
      fullName: 'Lucía Benítez',
    });

    expect(patient.allergies).toBe('Ninguna');
    expect(patient.metabolicProfile).toBe('Sin antecedentes metabólicos');
  });

  // Test 3: Listado de pacientes
  it('debe listar todos los pacientes registrados', async () => {
    await service.create({
      documentId: '1700000001',
      fullName: 'Paciente Uno',
    });
    await service.create({
      documentId: '1700000002',
      fullName: 'Paciente Dos',
    });

    const patients = await service.getAll();
    expect(patients).toHaveLength(2);
    expect(patients[0]?.documentId).toBe('1700000001');
    expect(patients[1]?.documentId).toBe('1700000002');
  });

  // Test 4: Consulta por ID existente
  it('debe recuperar un paciente por su identificador ID', async () => {
    const created = await service.create({
      documentId: '1712345678',
      fullName: 'Martín Cárdenas',
    });

    const found = await service.getById(created.id);
    expect(found.id).toBe(created.id);
    expect(found.fullName).toBe('Martín Cárdenas');
  });

  // Test 5: NotFoundError por ID inexistente
  it('debe lanzar NotFoundError al buscar un paciente con ID inexistente', async () => {
    await expect(service.getById(888)).rejects.toThrow(NotFoundError);
    await expect(service.getById(888)).rejects.toThrow(
      'No se encontró ningún paciente con el identificador 888.'
    );
  });

  // Test 6: DomainError por documento de identidad inválido
  it('debe lanzar DomainError si el documento de identidad tiene menos de 5 caracteres', async () => {
    await expect(
      service.create({
        documentId: '123',
        fullName: 'Carlos Gómez',
      })
    ).rejects.toThrow('El documento de identidad debe tener al menos 5 caracteres.');
  });

  // Test 7: DomainError por documento de identidad duplicado
  it('debe rechazar con DomainError un documento de identidad duplicado', async () => {
    await service.create({
      documentId: '1755443322',
      fullName: 'Fernanda Dávila',
    });

    await expect(
      service.create({
        documentId: '1755443322',
        fullName: 'Fernanda Dávila Clon',
      })
    ).rejects.toThrow('Ya existe un paciente registrado con este documento de identidad.');
  });

  // Test 8: DomainError por nombre inválido o menor a 3 caracteres
  it('debe lanzar DomainError si el nombre tiene menos de 3 caracteres', async () => {
    await expect(
      service.create({
        documentId: '1799001122',
        fullName: 'Jo',
      })
    ).rejects.toThrow('El nombre completo del paciente debe tener al menos 3 caracteres.');
  });
});
