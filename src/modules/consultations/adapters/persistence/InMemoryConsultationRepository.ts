import type {
  Consultation,
  UpdateConsultationData,
} from '../../domain/Consultation.js';
import type { ConsultationRepository } from '../../ports/ConsultationRepository.js';
import {
  cosineSimilarity,
  buildClinicalVector,
} from '../../../../shared/domain/utils/vectorMath.js';

export interface ClinicalKnowledgeItem {
  id: number;
  code: string;
  category: string;
  bookSource: string;
  content: string;
  vector: number[];
}

const DEFAULT_KNOWLEDGE_BASE: ClinicalKnowledgeItem[] = [
  {
    id: 1,
    code: 'EASL-NAFLD-2023',
    category: 'Hepatología Metabólica',
    bookSource: 'EASL Clinical Practice Guidelines (Hígado Graso)',
    content:
      'Enfermedad por hígado graso no alcohólico (esteatosis hepática): La ingesta de fructosa libre y azúcares simples acelera la lipogénesis hepática de novo y eleva enzimas AST/ALT. Reducir drásticamente bebidas azucaradas y vigilar fármacos hepatotóxicos como paracetamol a altas dosis.',
    vector: buildClinicalVector(
      'higado graso esteatosis hepatica fructosa azucares lipogenesis transaminasas ast alt paracetamol hepatotoxico'
    ),
  },
  {
    id: 2,
    code: 'ADA-KETO-ELEC-2024',
    category: 'Metabolismo y Nutrición',
    bookSource: 'ADA Standards of Care / Fisiología Metabólica',
    content:
      'Natriuresis por restricción estricta de carbohidratos (dietas cetogénicas o low-carb): La rápida reducción de insulina plasmática induce excreción renal marcada de sodio y agua. Obligatorio reponer sodio, potasio y citrato de magnesio con abundante agua para evitar cefalea y taquicardia refleja.',
    vector: buildClinicalVector(
      'keto cetogenica low-carb electrolitos sodio potasio magnesio natriuresis hidratacion deshidratacion cefalea'
    ),
  },
  {
    id: 3,
    code: 'AHA-LIPID-LDL-2023',
    category: 'Cardiometabolismo',
    bookSource: 'AHA/ACC Guía de Manejo del Colesterol y Dislipidemias',
    content:
      'Dislipidemias y riesgo aterogénico: Pacientes con elevación de colesterol LDL y triglicéridos deben restringir ácidos grasos saturados y grasas trans. Se recomienda perfil lipídico seriado y evaluación de riesgo cardiovascular a 10 años.',
    vector: buildClinicalVector(
      'dislipidemia colesterol ldl trigliceridos grasas saturadas trans riesgo cardiovascular aterosclerosis'
    ),
  },
  {
    id: 4,
    code: 'HARRISON-RED-FLAGS-2023',
    category: 'Semiología de Urgencias',
    bookSource: 'Harrison Principios de Medicina Interna - Banderas Rojas',
    content:
      'Signos de alarma en triaje urgente: Fiebre alta sobre 38.5°C, dolor torácico opresivo, disnea aguda de reposo, rigidez de nuca y pérdida de conciencia exigen atención médica inmediata y monitoreo continuo de constantes vitales.',
    vector: buildClinicalVector(
      'dolor pecho toracico disnea falta aire fiebre rigidez nuca sincope desmayo bandera roja urgente urgencias'
    ),
  },
];

export const createInMemoryConsultationRepository = (
  initialConsultations: Consultation[] = [],
  initialKnowledge: ClinicalKnowledgeItem[] = DEFAULT_KNOWLEDGE_BASE
): ConsultationRepository => {
  const consultations: Consultation[] = [...initialConsultations];
  const knowledgeBase: ClinicalKnowledgeItem[] = [...initialKnowledge];
  let nextId = consultations.reduce((max, c) => Math.max(max, c.id), 0) + 1;

  const create = async (consultation: Consultation): Promise<Consultation> => {
    const created: Consultation = {
      ...consultation,
      id: consultation.id > 0 ? consultation.id : nextId++,
      createdAt: consultation.createdAt ?? new Date(),
    };
    consultations.push(created);
    return { ...created };
  };

  const findAll = async (): Promise<Consultation[]> => {
    return consultations.map((c) => ({ ...c }));
  };

  const findById = async (id: number): Promise<Consultation | null> => {
    const found = consultations.find((c) => c.id === id);
    return found ? { ...found } : null;
  };

  const update = async (
    id: number,
    data: UpdateConsultationData
  ): Promise<Consultation | null> => {
    const index = consultations.findIndex((c) => c.id === id);
    if (index === -1) {
      return null;
    }

    const current = consultations[index];
    if (!current) {
      return null;
    }

    const updated: Consultation = {
      ...current,
      ...(data.doctorNotes !== undefined && { doctorNotes: data.doctorNotes }),
      ...(data.soapDraft !== undefined && { soapDraft: data.soapDraft }),
      ...(data.validatedByDoctor !== undefined && {
        validatedByDoctor: data.validatedByDoctor,
      }),
    };

    consultations[index] = updated;
    return { ...updated };
  };

  const deleteById = async (id: number): Promise<boolean> => {
    const index = consultations.findIndex((c) => c.id === id);
    if (index === -1) {
      return false;
    }
    consultations.splice(index, 1);
    return true;
  };

  const findSimilarContext = async (
    patientId: number,
    queryVector: number[]
  ): Promise<string> => {
    const matchedFragments: Array<{ score: number; text: string }> = [];

    // 1. Consultas previas aisladas estrictamente al paciente
    const patientHistory = consultations.filter((c) => c.patientId === patientId);
    for (const record of patientHistory) {
      try {
        const storedVec = JSON.parse(record.symptomVector) as number[];
        const score = cosineSimilarity(queryVector, storedVec);
        if (score > 0.25) {
          matchedFragments.push({
            score,
            text: `[Historial del Paciente - Consulta previa ID #${record.id}]: Síntomas: "${record.symptoms}". Alertas previas: ${record.metabolicAlerts}.`,
          });
        }
      } catch {
        // En caso de vector no parseable se omite silenciosamente
      }
    }

    // 2. Base de conocimiento bibliográfica
    for (const item of knowledgeBase) {
      const score = cosineSimilarity(queryVector, item.vector);
      if (score > 0.25) {
        matchedFragments.push({
          score,
          text: `[Evidencia Clínica - ${item.bookSource} (${item.code})]: ${item.content}`,
        });
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
