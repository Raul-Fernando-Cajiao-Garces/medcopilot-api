import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { createInMemoryDoctorRepository } from '../../src/modules/doctors/adapters/persistence/InMemoryDoctorRepository.js';
import { createInMemoryPatientRepository } from '../../src/modules/patients/adapters/persistence/InMemoryPatientRepository.js';
import { createInMemoryConsultationRepository } from '../../src/modules/consultations/adapters/persistence/InMemoryConsultationRepository.js';
import { createInMemoryClinicalCopilotAdapter } from '../../src/modules/consultations/adapters/copilot/InMemoryClinicalCopilotAdapter.js';

describe('HTTP API Endpoints (Integration Tests with Supertest)', () => {
  let app: Express;

  beforeEach(async () => {
    const doctorRepo = createInMemoryDoctorRepository();
    const patientRepo = createInMemoryPatientRepository();
    const consultationRepo = createInMemoryConsultationRepository();
    const copilotPort = createInMemoryClinicalCopilotAdapter();

    app = createApp({
      doctorRepository: doctorRepo,
      patientRepository: patientRepo,
      consultationRepository: consultationRepo,
      clinicalCopilotPort: copilotPort,
    });

    // Inserción inicial
    await doctorRepo.create({
      fullName: 'Dr. Santiago Andrade',
      specialty: 'Medicina Familiar',
      licenseCode: 'FAM-6677',
    });

    await patientRepo.create({
      documentId: '1722883344',
      fullName: 'Camila Villacís',
      allergies: 'Penicilina',
      metabolicProfile: 'Resistencia a la insulina',
    });
  });

  // Test 1: POST /api/doctors y POST /api/patients devolviendo 201
  it('debe crear un médico y un paciente vía HTTP respondiendo 201 Created', async () => {
    const doctorRes = await request(app)
      .post('/api/doctors')
      .send({
        fullName: 'Dra. Diana Montero',
        specialty: 'Cardiología',
        licenseCode: 'CARD-4455',
      });

    expect(doctorRes.status).toBe(201);
    expect(doctorRes.body.fullName).toBe('Dra. Diana Montero');

    const patientRes = await request(app)
      .post('/api/patients')
      .send({
        documentId: '1711998877',
        fullName: 'Jorge Roldán',
        allergies: 'Ninguna',
        metabolicProfile: 'Sin antecedentes',
      });

    expect(patientRes.status).toBe(201);
    expect(patientRes.body.documentId).toBe('1711998877');
  });

  // Test 2: POST /api/consultations válido devolviendo 201 con SOAP, prioridad y alertas
  it('debe registrar una consulta médica vía HTTP 201 con triaje, alertas y borrador SOAP', async () => {
    const res = await request(app)
      .post('/api/consultations')
      .send({
        patientId: 1,
        doctorId: 1,
        symptoms: 'Fiebre moderada y dolor de garganta.',
        temperature: 37.5,
        painLevel: 4,
        proposedIndications: 'Reposo e hidratación.',
      });

    expect(res.status).toBe(201);
    expect(res.body.triagePriority).toBe('NORMAL');
    expect(res.body.metabolicAlerts).toBeDefined();
    expect(res.body.soapDraft).toContain('[S - SUBJETIVO]');
    expect(res.body.soapDraft).toContain('[P - PLAN TERAPÉUTICO SUGERIDO]');
  });

  // Test 3: POST /api/consultations con patientId inexistente responde 400 y mensaje en español
  it('debe responder 400 Bad Request con mensaje en español si el paciente no existe', async () => {
    const res = await request(app)
      .post('/api/consultations')
      .send({
        patientId: 9999, // Inexistente
        doctorId: 1,
        symptoms: 'Cefalea leve.',
        temperature: 36.6,
        painLevel: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El paciente con ID 9999 no existe en el sistema.');
  });

  // Test 4: GET /api/consultations/:id devolviendo 200 con datos relacionados y 404 si no existe
  it('debe responder 200 con datos relacionados o 404 Not Found si el ID no existe', async () => {
    const created = await request(app)
      .post('/api/consultations')
      .send({
        patientId: 1,
        doctorId: 1,
        symptoms: 'Evaluación de control clínico.',
        temperature: 36.5,
        painLevel: 1,
      });

    const consultId = created.body.id as number;

    const res200 = await request(app).get(`/api/consultations/${consultId}`);
    expect(res200.status).toBe(200);
    expect(res200.body.patientName).toBe('Camila Villacís');
    expect(res200.body.doctorName).toBe('Dr. Santiago Andrade');

    const res404 = await request(app).get('/api/consultations/99999');
    expect(res404.status).toBe(404);
    expect(res404.body.message).toContain('No se encontró ninguna consulta médica con el identificador 99999.');
  });

  // Test 5: PUT /api/consultations/:id validando firma del médico (200)
  it('debe responder 200 OK y actualizar notas/firma médica del profesional', async () => {
    const created = await request(app)
      .post('/api/consultations')
      .send({
        patientId: 1,
        doctorId: 1,
        symptoms: 'Molestia abdominal difusa.',
        temperature: 36.8,
        painLevel: 3,
      });

    const consultId = created.body.id as number;

    const updateRes = await request(app)
      .put(`/api/consultations/${consultId}`)
      .send({
        doctorNotes: 'Consulta validada formalmente por el médico tratante.',
        validatedByDoctor: true,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.validatedByDoctor).toBe(true);
    expect(updateRes.body.doctorNotes).toBe(
      'Consulta validada formalmente por el médico tratante.'
    );
  });

  // Test 6: DELETE /api/consultations/:id eliminando el registro (200) y comprobando 404 posterior
  it('debe responder 200 al eliminar la consulta y 404 al intentar consultarla después', async () => {
    const created = await request(app)
      .post('/api/consultations')
      .send({
        patientId: 1,
        doctorId: 1,
        symptoms: 'Consulta de descarte para eliminación.',
        temperature: 36.5,
        painLevel: 1,
      });

    const consultId = created.body.id as number;

    const deleteRes = await request(app).delete(`/api/consultations/${consultId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Consulta médica eliminada exitosamente.');

    const checkRes = await request(app).get(`/api/consultations/${consultId}`);
    expect(checkRes.status).toBe(404);
  });
});
