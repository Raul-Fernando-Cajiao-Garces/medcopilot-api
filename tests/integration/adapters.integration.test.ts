import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import dotenv from 'dotenv';
import { createPostgresDoctorRepository } from '../../src/modules/doctors/adapters/persistence/PostgresDoctorRepository.js';
import { createPostgresPatientRepository } from '../../src/modules/patients/adapters/persistence/PostgresPatientRepository.js';
import { createPostgresConsultationRepository } from '../../src/modules/consultations/adapters/persistence/PostgresConsultationRepository.js';
import type { Consultation } from '../../src/modules/consultations/domain/Consultation.js';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Postgres Adapters (Integration Tests - PostgreSQL Real)', () => {
  let testPool: pg.Pool;

  beforeAll(async () => {
    const dbUrl = process.env['DATABASE_URL'];
    const testDbUrl = process.env['TEST_DATABASE_URL'];

    // Protección obligatoria de rúbrica contra sobreescritura de base de desarrollo
    if (!testDbUrl || testDbUrl.trim().length === 0 || testDbUrl === dbUrl) {
      throw new Error(
        'Protección activa: TEST_DATABASE_URL debe ser distinta de DATABASE_URL'
      );
    }

    testPool = new Pool({
      connectionString: testDbUrl,
      max: 5,
    });

    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await testPool.query(schemaSql);
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
  });

  // Test 1: Guardar y consultar médico en PostgreSQL
  it('debe persistir y consultar un médico en PostgreSQL real', async () => {
    const doctorRepo = createPostgresDoctorRepository(testPool);
    const created = await doctorRepo.create({
      fullName: 'Dr. Leonardo Viteri',
      specialty: 'Traumatología',
      licenseCode: 'TRAU-8899',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.fullName).toBe('Dr. Leonardo Viteri');

    const retrieved = await doctorRepo.findById(created.id);
    expect(retrieved?.licenseCode).toBe('TRAU-8899');
  });

  // Test 2: Guardar y consultar paciente en PostgreSQL
  it('debe persistir y consultar un paciente en PostgreSQL real', async () => {
    const patientRepo = createPostgresPatientRepository(testPool);
    const created = await patientRepo.create({
      documentId: '1788776655',
      fullName: 'Paola Alarcón',
      allergies: 'Ninguna',
      metabolicProfile: 'Sin antecedentes metabólicos',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.documentId).toBe('1788776655');

    const retrieved = await patientRepo.findByDocumentId('1788776655');
    expect(retrieved?.fullName).toBe('Paola Alarcón');
  });

  // Test 3: Guardar consulta con FOREIGN KEY y recuperar nombres por JOIN
  it('debe persistir una consulta médica y recuperar nombres relacionados con JOIN', async () => {
    const doctorRepo = createPostgresDoctorRepository(testPool);
    const patientRepo = createPostgresPatientRepository(testPool);
    const consultationRepo = createPostgresConsultationRepository(testPool);

    const doc = await doctorRepo.create({
      fullName: 'Dra. Gabriela Ramos',
      specialty: 'Gastroenterología',
      licenseCode: 'GAST-1122',
    });

    const pat = await patientRepo.create({
      documentId: '1799112233',
      fullName: 'Guillermo Pazmiño',
      allergies: 'Sulfas',
      metabolicProfile: 'Dislipidemia e hipertrigliceridemia',
    });

    const newConsultation: Consultation = {
      id: 0,
      patientId: pat.id,
      doctorId: doc.id,
      symptoms: 'Dispepsia recurrente y acidez retroesternal.',
      temperature: 36.7,
      painLevel: 3,
      proposedIndications: 'Omeprazol matutino y control dietético.',
      triagePriority: 'NORMAL',
      metabolicAlerts: 'Monitorear lípidos.',
      ragContext: 'Evidencia sobre reflujo gastroesofágico.',
      soapDraft: 'Borrador SOAP inicial.',
      symptomVector: JSON.stringify([0.1, 0.2, 0.3]),
      doctorNotes: 'Consulta inicial completada.',
      validatedByDoctor: false,
      createdAt: new Date(),
    };

    const created = await consultationRepo.create(newConsultation);

    expect(created.id).toBeGreaterThan(0);
    expect(created.patientName).toBe('Guillermo Pazmiño');
    expect(created.doctorName).toBe('Dra. Gabriela Ramos');
    expect(created.doctorSpecialty).toBe('Gastroenterología');
  });

  // Test 4: Violación de integridad referencial con FK inexistente
  it('debe fallar con error de clave foránea al intentar insertar consulta con paciente inexistente', async () => {
    const consultationRepo = createPostgresConsultationRepository(testPool);
    const invalidConsultation: Consultation = {
      id: 0,
      patientId: 99999, // ID inexistente
      doctorId: 1,
      symptoms: 'Dolor.',
      temperature: 36.5,
      painLevel: 2,
      proposedIndications: '',
      triagePriority: 'NORMAL',
      metabolicAlerts: '',
      ragContext: '',
      soapDraft: '',
      symptomVector: '[]',
      doctorNotes: '',
      validatedByDoctor: false,
      createdAt: new Date(),
    };

    await expect(consultationRepo.create(invalidConsultation)).rejects.toThrow();
  });

  // Test 5: Actualización de notas y firma médica (PUT)
  it('debe actualizar las notas médicas y la validación del profesional en PostgreSQL', async () => {
    const consultationRepo = createPostgresConsultationRepository(testPool);
    const consultations = await consultationRepo.findAll();
    const target = consultations[0];
    expect(target).toBeDefined();

    if (target) {
      const updated = await consultationRepo.update(target.id, {
        doctorNotes: 'Notas ampliadas tras reevaluación presencial.',
        validatedByDoctor: true,
      });

      expect(updated?.doctorNotes).toBe('Notas ampliadas tras reevaluación presencial.');
      expect(updated?.validatedByDoctor).toBe(true);
    }
  });

  // Test 6: Eliminación física en PostgreSQL (DELETE)
  it('debe eliminar una consulta de PostgreSQL y devolver null en búsqueda posterior', async () => {
    const consultationRepo = createPostgresConsultationRepository(testPool);
    const consultations = await consultationRepo.findAll();
    const target = consultations[0];
    expect(target).toBeDefined();

    if (target) {
      const deleted = await consultationRepo.delete(target.id);
      expect(deleted).toBe(true);

      const foundAfter = await consultationRepo.findById(target.id);
      expect(foundAfter).toBeNull();
    }
  });
});
