import type { Pool } from 'pg';
import type {
  Consultation,
  UpdateConsultationData,
  TriagePriority,
} from '../../domain/Consultation.js';
import type { ConsultationRepository } from '../../ports/ConsultationRepository.js';
import { cosineSimilarity } from '../../../../shared/domain/utils/vectorMath.js';

interface JoinedConsultationRow {
  id: number;
  patient_id: number;
  doctor_id: number;
  patient_name?: string;
  patient_allergies?: string;
  patient_metabolic_profile?: string;
  doctor_name?: string;
  doctor_specialty?: string;
  symptoms: string;
  temperature: string | number;
  pain_level: number;
  proposed_indications: string;
  triage_priority: string;
  metabolic_alerts: string;
  rag_context: string;
  soap_draft: string;
  symptom_vector: string;
  doctor_notes: string;
  validated_by_doctor: boolean;
  created_at: Date;
}

interface KnowledgeRow {
  code: string;
  book_source: string;
  content: string;
  embedding_vector: string;
}

interface HistoryRow {
  id: number;
  symptoms: string;
  metabolic_alerts: string;
  symptom_vector: string;
}

const mapRowToConsultation = (row: JoinedConsultationRow): Consultation => ({
  id: row.id,
  patientId: row.patient_id,
  doctorId: row.doctor_id,
  ...(row.patient_name !== undefined && { patientName: row.patient_name }),
  ...(row.patient_allergies !== undefined && { patientAllergies: row.patient_allergies }),
  ...(row.patient_metabolic_profile !== undefined && {
    patientMetabolicProfile: row.patient_metabolic_profile,
  }),
  ...(row.doctor_name !== undefined && { doctorName: row.doctor_name }),
  ...(row.doctor_specialty !== undefined && { doctorSpecialty: row.doctor_specialty }),
  symptoms: row.symptoms,
  temperature: Number(row.temperature),
  painLevel: Number(row.pain_level),
  proposedIndications: row.proposed_indications,
  triagePriority: row.triage_priority as TriagePriority,
  metabolicAlerts: row.metabolic_alerts,
  ragContext: row.rag_context,
  soapDraft: row.soap_draft,
  symptomVector: row.symptom_vector,
  doctorNotes: row.doctor_notes,
  validatedByDoctor: Boolean(row.validated_by_doctor),
  createdAt: new Date(row.created_at),
});

const SELECT_JOINED_QUERY = `
  SELECT 
    c.id,
    c.patient_id,
    c.doctor_id,
    p.full_name AS patient_name,
    p.allergies AS patient_allergies,
    p.metabolic_profile AS patient_metabolic_profile,
    d.full_name AS doctor_name,
    d.specialty AS doctor_specialty,
    c.symptoms,
    c.temperature,
    c.pain_level,
    c.proposed_indications,
    c.triage_priority,
    c.metabolic_alerts,
    c.rag_context,
    c.soap_draft,
    c.symptom_vector,
    c.doctor_notes,
    c.validated_by_doctor,
    c.created_at
  FROM consultations c
  INNER JOIN patients p ON c.patient_id = p.id
  INNER JOIN doctors d ON c.doctor_id = d.id
`;

export const createPostgresConsultationRepository = (pool: Pool): ConsultationRepository => {
  const findAll = async (): Promise<Consultation[]> => {
    const query = `${SELECT_JOINED_QUERY} ORDER BY c.id DESC`;
    const result = await pool.query<JoinedConsultationRow>(query);
    return result.rows.map(mapRowToConsultation);
  };

  const findById = async (id: number): Promise<Consultation | null> => {
    const query = `${SELECT_JOINED_QUERY} WHERE c.id = $1`;
    const result = await pool.query<JoinedConsultationRow>(query, [id]);
    const row = result.rows[0];
    return row ? mapRowToConsultation(row) : null;
  };

  const create = async (consultation: Consultation): Promise<Consultation> => {
    const query = `
      INSERT INTO consultations (
        patient_id,
        doctor_id,
        symptoms,
        temperature,
        pain_level,
        proposed_indications,
        triage_priority,
        metabolic_alerts,
        rag_context,
        soap_draft,
        symptom_vector,
        doctor_notes,
        validated_by_doctor,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `;

    const result = await pool.query<{ id: number }>(query, [
      consultation.patientId,
      consultation.doctorId,
      consultation.symptoms,
      consultation.temperature,
      consultation.painLevel,
      consultation.proposedIndications,
      consultation.triagePriority,
      consultation.metabolicAlerts,
      consultation.ragContext,
      consultation.soapDraft,
      consultation.symptomVector,
      consultation.doctorNotes,
      consultation.validatedByDoctor,
      consultation.createdAt,
    ]);

    const createdId = result.rows[0]?.id;
    if (!createdId) {
      throw new Error('Error al registrar la consulta médica en PostgreSQL.');
    }

    const created = await findById(createdId);
    if (!created) {
      throw new Error('No se pudo recuperar la consulta creada.');
    }

    return created;
  };

  const update = async (
    id: number,
    data: UpdateConsultationData
  ): Promise<Consultation | null> => {
    const existing = await findById(id);
    if (!existing) {
      return null;
    }

    const nextDoctorNotes = data.doctorNotes ?? existing.doctorNotes;
    const nextSoapDraft = data.soapDraft ?? existing.soapDraft;
    const nextValidated = data.validatedByDoctor ?? existing.validatedByDoctor;

    const query = `
      UPDATE consultations
      SET doctor_notes = $1, soap_draft = $2, validated_by_doctor = $3
      WHERE id = $4
    `;
    await pool.query(query, [nextDoctorNotes, nextSoapDraft, nextValidated, id]);
    return findById(id);
  };

  const deleteById = async (id: number): Promise<boolean> => {
    const query = 'DELETE FROM consultations WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  };

  const findSimilarContext = async (
    patientId: number,
    queryVector: number[]
  ): Promise<string> => {
    const matchedFragments: Array<{ score: number; text: string }> = [];

    // 1. Consultas previas aisladas por paciente
    const historyQuery = `
      SELECT id, symptoms, metabolic_alerts, symptom_vector
      FROM consultations
      WHERE patient_id = $1
      ORDER BY id DESC
      LIMIT 10
    `;
    const historyResult = await pool.query<HistoryRow>(historyQuery, [patientId]);
    for (const record of historyResult.rows) {
      try {
        const storedVec = JSON.parse(record.symptom_vector) as number[];
        const score = cosineSimilarity(queryVector, storedVec);
        if (score > 0.25) {
          matchedFragments.push({
            score,
            text: `[Historial del Paciente - Consulta previa ID #${record.id}]: Síntomas: "${record.symptoms}". Alertas previas: ${record.metabolic_alerts}.`,
          });
        }
      } catch {
        // Omite registro si el vector no es parseable
      }
    }

    // 2. Base de datos de conocimiento clínico
    const knowledgeQuery = `
      SELECT code, book_source, content, embedding_vector
      FROM clinical_knowledge
    `;
    const knowledgeResult = await pool.query<KnowledgeRow>(knowledgeQuery);
    for (const item of knowledgeResult.rows) {
      try {
        const storedVec = JSON.parse(item.embedding_vector) as number[];
        const score = cosineSimilarity(queryVector, storedVec);
        if (score > 0.25) {
          matchedFragments.push({
            score,
            text: `[Evidencia Clínica - ${item.book_source} (${item.code})]: ${item.content}`,
          });
        }
      } catch {
        // Omite si el vector no es parseable
      }
    }

    matchedFragments.sort((a, b) => b.score - a.score);
    const topMatches = matchedFragments.slice(0, 3);

    if (topMatches.length === 0) {
      return '';
    }

    return topMatches.map((m) => m.text).join('\n---\n');
  };

  return {
    create,
    findAll,
    findById,
    update,
    delete: deleteById,
    findSimilarContext,
  };
};
