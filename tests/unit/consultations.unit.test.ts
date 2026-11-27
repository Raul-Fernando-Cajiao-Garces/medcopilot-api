import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryDoctorRepository } from '../../src/modules/doctors/adapters/persistence/InMemoryDoctorRepository.js';
import { createInMemoryPatientRepository } from '../../src/modules/patients/adapters/persistence/InMemoryPatientRepository.js';
import { createInMemoryConsultationRepository } from '../../src/modules/consultations/adapters/persistence/InMemoryConsultationRepository.js';
import { createInMemoryClinicalCopilotAdapter } from '../../src/modules/consultations/adapters/copilot/InMemoryClinicalCopilotAdapter.js';
import { createConsultationService } from '../../src/modules/consultations/application/ConsultationService.js';
import type { ConsultationService } from '../../src/modules/consultations/application/ConsultationService.js';
import type { DoctorRepository } from '../../src/modules/doctors/ports/DoctorRepository.js';
import type { PatientRepository } from '../../src/modules/patients/ports/PatientRepository.js';
import type { ConsultationRepository } from '../../src/modules/consultations/ports/ConsultationRepository.js';
import { DomainError } from '../../src/shared/domain/errors/DomainError.js';
import { NotFoundError } from '../../src/shared/domain/errors/NotFoundError.js';

describe('ConsultationService (Unit Tests)', () => {
  let consultationService: ConsultationService;
  let doctorRepo: DoctorRepository;
  let patientRepo: PatientRepository;
  let consultationRepo: ConsultationRepository;

  beforeEach(async () => {
    doctorRepo = createInMemoryDoctorRepository();
    patientRepo = createInMemoryPatientRepository();
    consultationRepo = createInMemoryConsultationRepository();
    const copilotAdapter = createInMemoryClinicalCopilotAdapter();

    consultationService = createConsultationService(
      consultationRepo,
      patientRepo,
      doctorRepo,
      copilotAdapter
    );

    // Semilla básica de prueba
    await doctorRepo.create({
      fullName: 'Dr. Fernando Salazar',
      specialty: 'Medicina Interna',
      licenseCode: 'INT-3301',
    });

    await patientRepo.create({
      documentId: '1711122233',
      fullName: 'Esteban Morales',
      allergies: 'Penicilina, Amoxicilina',
      metabolicProfile: 'Esteatosis hepática / hígado graso',
    });
  });

  // Test 1: Creación válida y generación de borrador SOAP
  it('debe crear una consulta válida con borrador SOAP y validatedByDoctor = false', async () => {
    const consultation = await consultationService.create({
      patientId: 1,
      doctorId: 1,
      symptoms: 'Cefalea tensional leve y cansancio general después de jornada laboral.',
      temperature: 36.6,
      painLevel: 3,
      proposedIndications: 'Reposo relativo e hidratación oral.',
    });

    expect(consultation.id).toBeGreaterThan(0);
    expect(consultation.patientId).toBe(1);
    expect(consultation.doctorId).toBe(1);
    expect(consultation.patientName).toBe('Esteban Morales');
    expect(consultation.doctorName).toBe('Dr. Fernando Salazar');
    expect(consultation.validatedByDoctor).toBe(false);
    expect(consultation.soapDraft).toContain('[S - SUBJETIVO]');
    expect(consultation.soapDraft).toContain('[O - OBJETIVO]');
    expect(consultation.soapDraft).toContain('[A - ANÁLISIS CLÍNICO Y RAG]');
    expect(consultation.soapDraft).toContain('[P - PLAN TERAPÉUTICO SUGERIDO]');
  });

  // Test 2: Validación de existencia de referencias (evitar datos huérfanos)
  it('debe rechazar con DomainError si el patientId o doctorId no existen', async () => {
    await expect(
      consultationService.create({
        patientId: 999,
        doctorId: 1,
        symptoms: 'Dolor de garganta leve.',
        temperature: 36.8,
        painLevel: 2,
      })
    ).rejects.toThrow('El paciente con ID 999 no existe en el sistema.');

    await expect(
      consultationService.create({
        patientId: 1,
        doctorId: 888,
        symptoms: 'Dolor de garganta leve.',
        temperature: 36.8,
        painLevel: 2,
      })
    ).rejects.toThrow('El médico con ID 888 no existe en el sistema.');
  });

  // Test 3: Clasificación URGENT (Fiebre, dolor severo o síntoma crítico)
  it('debe asignar prioridad URGENT si hay temperatura >= 38.5, dolor >= 8 o síntoma crítico', async () => {
    // Caso 1: Síntoma crítico (dolor de pecho)
    const urgentChestPain = await consultationService.create({
      patientId: 1,
      doctorId: 1,
      symptoms: 'Paciente presenta dolor de pecho opresivo irradiado a cuello.',
      temperature: 37.0,
      painLevel: 5,
    });
    expect(urgentChestPain.triagePriority).toBe('URGENT');

    // Caso 2: Fiebre alta
    const urgentFever = await consultationService.create({
      patientId: 1,
      doctorId: 1,
      symptoms: 'Fiebre persistente con escalofríos.',
      temperature: 38.9,
      painLevel: 4,
    });
    expect(urgentFever.triagePriority).toBe('URGENT');

    // Caso 3: Dolor severo EVA >= 8
    const urgentPain = await consultationService.create({
      patientId: 1,
      doctorId: 1,
      symptoms: 'Cólico lumbar intenso con diaforesis.',
      temperature: 36.8,
      painLevel: 9,
    });
    expect(urgentPain.triagePriority).toBe('URGENT');
  });

  // Test 4: Auditoría metabólica hepática (hígado graso + fructosa/naranja)
  it('debe emitir alerta metabólica hepática si el paciente tiene hígado graso y consume fructosa/jugos', async () => {
    const consultation = await consultationService.create({
      patientId: 1, // Esteban Morales: esteatosis hepática / hígado graso
      doctorId: 1,
      symptoms: 'Pesadez y dolor leve en hipocondrio derecho tras beber jugo de naranja concentrado.',
      temperature: 36.7,
      painLevel: 3,
      proposedIndications: 'Evitar alimentos grasos.',
    });

    expect(consultation.metabolicAlerts).toContain('[ALERTA METABÓLICA HEPÁTICA]');
    expect(consultation.metabolicAlerts).toContain('lipogénesis de novo');
  });

  // Test 5: Auditoría metabólica low-carb / cetogénica (natriuresis e hidratación)
  it('debe emitir alerta metabólica de natriuresis y electrolitos en pacientes en dieta low-carb / keto', async () => {
    const ketoPatient = await patientRepo.create({
      documentId: '1799988877',
      fullName: 'Carolina Espinoza',
      allergies: 'Ninguna',
      metabolicProfile: 'Protocolo keto / dieta cetogénica estricta baja en carbohidratos',
    });

    const consultation = await consultationService.create({
      patientId: ketoPatient.id,
      doctorId: 1,
      symptoms: 'Mareo al levantarse, sensación de debilidad muscular y sed intensa.',
      temperature: 36.5,
      painLevel: 2,
    });

    expect(consultation.metabolicAlerts).toContain('[ALERTA METABÓLICA ELECTROLÍTICA]');
    expect(consultation.metabolicAlerts).toContain('natriuresis renal');
    expect(consultation.metabolicAlerts).toContain('sodio, potasio');
  });

  // Test 6: Cross-check directo de alergias farmacológicas
  it('debe emitir alerta farmacológica grave si se receta un fármaco al que el paciente es alérgico', async () => {
    // Paciente 1 es alérgico a Penicilina y Amoxicilina
    const consultation = await consultationService.create({
      patientId: 1,
      doctorId: 1,
      symptoms: 'Infección respiratoria alta con congestión y malestar.',
      temperature: 37.4,
      painLevel: 4,
      proposedIndications: 'Iniciar amoxicilina 500mg cada 8 horas por 7 días.',
    });

    expect(consultation.metabolicAlerts).toContain('[ALERTA FARMACOLÓGICA GRAVE]');
    expect(consultation.metabolicAlerts).toContain('Betalactámicos / Penicilinas');
    expect(consultation.metabolicAlerts).toContain('amoxicilina');
  });

  // Test 7: Aislamiento estricto de contexto RAG por paciente
  it('debe recuperar antecedentes RAG aislados estrictamente por paciente sin contaminar otros', async () => {
    // Crear paciente B
    const patientB = await patientRepo.create({
      documentId: '1744556677',
      fullName: 'Beatriz Nuñez',
      allergies: 'Ninguna',
      metabolicProfile: 'Sin antecedentes metabólicos',
    });

    // Crear consulta previa para Paciente A (ID 1)
    await consultationService.create({
      patientId: 1,
      doctorId: 1,
      symptoms: 'Sensación de pesadez posprandial en hipocondrio derecho.',
      temperature: 36.8,
      painLevel: 3,
    });

    // Consulta para Paciente B con síntomas similares
    const consultationB = await consultationService.create({
      patientId: patientB.id,
      doctorId: 1,
      symptoms: 'Sensación de pesadez posprandial en hipocondrio derecho.',
      temperature: 36.8,
      painLevel: 3,
    });

    // El contexto de B no debe contener el ID del paciente A
    expect(consultationB.ragContext).not.toContain('ID #1');
  });

  // Test 8: CRUD completo (Actualización médica, eliminación y NotFoundError 404)
  it('debe permitir actualizar notas/firma médica, eliminar la consulta y responder 404 ante inexistentes', async () => {
    const created = await consultationService.create({
      patientId: 1,
      doctorId: 1,
      symptoms: 'Dolor abdominal inespecífico.',
      temperature: 36.9,
      painLevel: 4,
    });

    // Update / Firma médica
    const updated = await consultationService.update(created.id, {
      doctorNotes: 'Paciente evaluado clínicamente. Se corrobora mejoría de síntomas.',
      validatedByDoctor: true,
    });
    expect(updated.validatedByDoctor).toBe(true);
    expect(updated.doctorNotes).toBe(
      'Paciente evaluado clínicamente. Se corrobora mejoría de síntomas.'
    );

    // Delete
    await consultationService.delete(created.id);

    // Consulta posterior debe lanzar NotFoundError
    await expect(consultationService.getById(created.id)).rejects.toThrow(NotFoundError);
    await expect(
      consultationService.update(created.id, { validatedByDoctor: true })
    ).rejects.toThrow(NotFoundError);
    await expect(consultationService.delete(created.id)).rejects.toThrow(NotFoundError);
  });
});
