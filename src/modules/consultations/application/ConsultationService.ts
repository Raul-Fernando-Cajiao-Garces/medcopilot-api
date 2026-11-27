import type {
  Consultation,
  CreateConsultationInput,
  UpdateConsultationData,
} from '../domain/Consultation.js';
import { validateCreateConsultationInput } from '../domain/Consultation.js';
import {
  evaluateTriagePriority,
  auditMetabolicAndPharmacology,
} from '../domain/ClinicalRules.js';
import type { ConsultationRepository } from '../ports/ConsultationRepository.js';
import type { ClinicalCopilotPort } from '../ports/ClinicalCopilotPort.js';
import type { PatientRepository } from '../../patients/ports/PatientRepository.js';
import type { DoctorRepository } from '../../doctors/ports/DoctorRepository.js';
import { buildClinicalVector } from '../../../shared/domain/utils/vectorMath.js';
import { DomainError } from '../../../shared/domain/errors/DomainError.js';
import { NotFoundError } from '../../../shared/domain/errors/NotFoundError.js';

export interface ConsultationService {
  create: (input: CreateConsultationInput) => Promise<Consultation>;
  getAll: () => Promise<Consultation[]>;
  getById: (id: number) => Promise<Consultation>;
  update: (id: number, data: UpdateConsultationData) => Promise<Consultation>;
  delete: (id: number) => Promise<void>;
}

export const createConsultationService = (
  consultationRepo: ConsultationRepository,
  patientRepo: PatientRepository,
  doctorRepo: DoctorRepository,
  copilotPort: ClinicalCopilotPort
): ConsultationService => {
  const create = async (input: CreateConsultationInput): Promise<Consultation> => {
    validateCreateConsultationInput(input);

    // 1. Verificación obligatoria de existencia de claves foráneas
    const patient = await patientRepo.findById(input.patientId);
    if (!patient) {
      throw new DomainError(`El paciente con ID ${input.patientId} no existe en el sistema.`);
    }

    const doctor = await doctorRepo.findById(input.doctorId);
    if (!doctor) {
      throw new DomainError(`El médico con ID ${input.doctorId} no existe en el sistema.`);
    }

    // 2. Vectorización matemática en CPU
    const vector = buildClinicalVector(input.symptoms);
    const symptomVector = JSON.stringify(vector);

    // 3. Reglas de triaje y banderas rojas
    const triagePriority = evaluateTriagePriority(
      input.temperature,
      input.painLevel,
      input.symptoms
    );

    // 4. Auditoría metabólica y farmacológica
    const proposedIndications = input.proposedIndications?.trim() || '';
    const metabolicAlerts = auditMetabolicAndPharmacology({
      metabolicProfile: patient.metabolicProfile,
      allergies: patient.allergies,
      symptoms: input.symptoms,
      proposedIndications,
    });

    // 5. Recuperación RAG aislada por paciente y conocimiento médico
    const ragContext = await consultationRepo.findSimilarContext(patient.id, vector);

    // 6. Generación de borrador SOAP (IA o Determinista estructurado)
    const soapDraft = await copilotPort.generateSoapDraft({
      patientName: patient.fullName,
      doctorName: doctor.fullName,
      symptoms: input.symptoms,
      temperature: input.temperature,
      painLevel: input.painLevel,
      dias: input.dias ?? 1,
      triagePriority,
      metabolicProfile: patient.metabolicProfile,
      allergies: patient.allergies,
      metabolicAlerts,
      ragContext,
      proposedIndications,
    });

    // 7. Persistencia
    const newConsultation: Consultation = {
      id: 0,
      patientId: patient.id,
      doctorId: doctor.id,
      patientName: patient.fullName,
      patientAllergies: patient.allergies,
      patientMetabolicProfile: patient.metabolicProfile,
      doctorName: doctor.fullName,
      doctorSpecialty: doctor.specialty,
      symptoms: input.symptoms.trim(),
      temperature: input.temperature,
      painLevel: input.painLevel,
      dias: input.dias ?? 1,
      proposedIndications,
      triagePriority,
      metabolicAlerts,
      ragContext,
      soapDraft,
      symptomVector,
      doctorNotes: input.doctorNotes?.trim() || '',
      validatedByDoctor: false,
      createdAt: new Date(),
    };

    return consultationRepo.create(newConsultation);
  };

  const getAll = async (): Promise<Consultation[]> => {
    return consultationRepo.findAll();
  };

  const getById = async (id: number): Promise<Consultation> => {
    if (Number.isNaN(id) || id <= 0) {
      throw new DomainError('El identificador de la consulta debe ser un número entero positivo.');
    }

    const consultation = await consultationRepo.findById(id);
    if (!consultation) {
      throw new NotFoundError(`No se encontró ninguna consulta médica con el identificador ${id}.`);
    }

    return consultation;
  };

  const update = async (
    id: number,
    data: UpdateConsultationData
  ): Promise<Consultation> => {
    if (Number.isNaN(id) || id <= 0) {
      throw new DomainError('El identificador de la consulta debe ser un número entero positivo.');
    }

    const existing = await consultationRepo.findById(id);
    if (!existing) {
      throw new NotFoundError(`No se encontró ninguna consulta médica con el identificador ${id} para actualizar.`);
    }

    const updated = await consultationRepo.update(id, data);
    if (!updated) {
      throw new NotFoundError(`Error al actualizar la consulta médica con ID ${id}.`);
    }

    return updated;
  };

  const deleteById = async (id: number): Promise<void> => {
    if (Number.isNaN(id) || id <= 0) {
      throw new DomainError('El identificador de la consulta debe ser un número entero positivo.');
    }

    const existing = await consultationRepo.findById(id);
    if (!existing) {
      throw new NotFoundError(`No se encontró la consulta médica con ID ${id} para eliminar.`);
    }

    const success = await consultationRepo.delete(id);
    if (!success) {
      throw new NotFoundError(`No se pudo eliminar la consulta médica con ID ${id}.`);
    }
  };

  return {
    create,
    getAll,
    getById,
    update,
    delete: deleteById,
  };
};
