import type { Consultation, UpdateConsultationData } from '../domain/Consultation.js';

export interface ConsultationRepository {
  create: (consultation: Consultation) => Promise<Consultation>;
  findAll: () => Promise<Consultation[]>;
  findById: (id: number) => Promise<Consultation | null>;
  update: (id: number, data: UpdateConsultationData) => Promise<Consultation | null>;
  delete: (id: number) => Promise<boolean>;
  findSimilarContext: (patientId: number, queryVector: number[]) => Promise<string>;
}
