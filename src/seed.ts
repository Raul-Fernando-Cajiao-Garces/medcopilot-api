import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { pool } from './shared/adapters/database/pgPool.js';
import { buildClinicalVector } from './shared/domain/utils/vectorMath.js';
import {
  evaluateTriagePriority,
  auditMetabolicAndPharmacology,
} from './modules/consultations/domain/ClinicalRules.js';
import { generateDeterministicSoap } from './modules/consultations/adapters/copilot/deterministicSoapGenerator.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DoctorSeed {
  fullName: string;
  specialty: string;
  licenseCode: string;
}

interface PatientSeed {
  documentId: string;
  fullName: string;
  allergies: string;
  metabolicProfile: string;
}

interface KnowledgeSeed {
  code: string;
  category: string;
  bookSource: string;
  content: string;
}

const DOCTORS_SEED: DoctorSeed[] = [
  {
    fullName: 'Dr. Carlos Mendoza Solís',
    specialty: 'Medicina Interna y Hepatología',
    licenseCode: 'MED-77401',
  },
  {
    fullName: 'Dra. Elena Paredes Vaca',
    specialty: 'Endocrinología y Metabolismo Clínico',
    licenseCode: 'MED-88203',
  },
];

const PATIENTS_SEED: PatientSeed[] = [
  {
    documentId: '1723456789',
    fullName: 'Juan Pérez Albán',
    allergies: 'Penicilina, Amoxicilina',
    metabolicProfile:
      'Esteatosis hepática no alcohólica (hígado graso grado II), transaminasas elevadas',
  },
  {
    documentId: '1798765432',
    fullName: 'María Fernanda Salgado',
    allergies: 'Ninguna',
    metabolicProfile:
      'Resistencia a la insulina, adherida a protocolo low-carb / dieta cetogénica',
  },
  {
    documentId: '1711223344',
    fullName: 'Roberto Gómez Viteri',
    allergies: 'AINEs (Ibuprofeno, Aspirina, Diclofenaco)',
    metabolicProfile:
      'Dislipidemia mixta, colesterol LDL 182 mg/dL, hipertrigliceridemia aterogénica',
  },
];

const KNOWLEDGE_SEEDS: KnowledgeSeed[] = [
  {
    code: 'EASL-NAFLD-01',
    category: 'Hepatología Metabólica',
    bookSource: 'EASL Clinical Practice Guidelines (Hígado Graso)',
    content:
      'Enfermedad por esteatosis hepática metabólica (hígado graso): La fructosa líquida y los azúcares concentrados sobrecargan de inmediato la lipogénesis de novo hepática, agravando la esteatohepatitis. Restringir zumos de frutas, refrescos y azúcares simples.',
  },
  {
    code: 'ADA-LOWCARB-02',
    category: 'Metabolismo y Nutrición',
    bookSource: 'ADA Standards of Care / Fisiología Renal y Metabólica',
    content:
      'Natriuresis por baja ingesta de carbohidratos (dietas low-carb / keto): Al disminuir la concentración de insulina circulante, los túbulos renales incrementan la eliminación de sodio y agua. La suplementación con sodio, potasio y citrato de magnesio junto a abundante hidratación previene la cefalea y fatiga.',
  },
  {
    code: 'AHA-LIPID-03',
    category: 'Cardiometabolismo Preventivo',
    bookSource: 'AHA/ACC Guía de Manejo del Colesterol y Riesgo Cardiovascular',
    content:
      'Dislipidemia aterogénica y colesterol LDL elevado: Limitar drásticamente ácidos grasos saturados y grasas trans de origen ultraprocesado. Priorizar ácidos grasos monoinsaturados (aceite de oliva virgen extra) y fibra soluble para reducir la absorción de colesterol.',
  },
  {
    code: 'HARRISON-RED-FLAGS-04',
    category: 'Semiología de Urgencias',
    bookSource: 'Harrison Principios de Medicina Interna - Banderas Rojas',
    content:
      'Criterios de triaje urgente (banderas rojas): Fiebre elevada (>=38.5°C), dolor torácico de características isquémicas, disnea aguda de reposo, rigidez nucal o pérdida de conocimiento requieren evaluación médica presencial inmediata y monitoreo continuo.',
  },
  {
    code: 'ARGENTE-EVA-05',
    category: 'Semiología Clínica',
    bookSource: 'Argente-Álvarez Semiología Médica (Evaluación del Dolor)',
    content:
      'Escala Visual Analógica (EVA): Una puntuación de dolor igual o superior a 8/10 indica dolor severo invalidante que requiere priorización urgente de triaje y abordaje analgésico bajo supervisión.',
  },
  {
    code: 'KRAUSE-INSULIN-06',
    category: 'Dietoterapia y Metabolismo',
    bookSource: 'Krause Dietoterapia - Manejo Nutricional de la Resistencia Insulínica',
    content:
      'Resistencia a la insulina y control glucémico: Los picos de glucosa posprandial inducidos por carbohidratos refinados estimulan hiperinsulinemia compensatoria. El fraccionamiento calórico y la actividad muscular de baja intensidad posprandial mejoran la sensibilidad insulínica.',
  },
  {
    code: 'EASL-DILI-07',
    category: 'Farmacología y Toxicología',
    bookSource: 'EASL Drug-Induced Liver Injury Guidelines',
    content:
      'Hepatotoxicidad por fármacos: En pacientes con hepatopatía preexistente o esteatohepatitis, dosis elevadas o sostenidas de paracetamol superan la vía de conjugación por glutatión, elevando el metabolito tóxico NAPQI. Ajustar siempre a dosis mínimas.',
  },
  {
    code: 'HARRISON-ALLERGY-08',
    category: 'Inmunología Clínica',
    bookSource: 'Harrison Inmunología Clínica - Reacciones de Hipersensibilidad',
    content:
      'Alergias a betalactámicos y AINEs: Antecedentes confirmados de reacción anafiláctica o cutánea grave a penicilinas contraindican amoxicilina y aminopenicilinas. De igual manera, intolerancia a AINEs contraindica ibuprofeno, diclofenaco y derivados.',
  },
];

export const runSeed = async (): Promise<void> => {
  console.log('[Seed] Iniciando inicialización y carga de datos médicos...');

  try {
    // 1. Ejecutar schema.sql
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
      console.log('[Seed] Creando tablas desde database/schema.sql...');
      await pool.query(sqlContent);
      console.log('[Seed] Tablas creadas con éxito.');
    }

    // 2. Insertar médicos
    console.log('[Seed] Insertando médicos...');
    const insertedDoctors: Array<{ id: number; fullName: string; specialty: string }> = [];
    for (const doc of DOCTORS_SEED) {
      const res = await pool.query<{ id: number; full_name: string; specialty: string }>(
        `INSERT INTO doctors (full_name, specialty, license_code)
         VALUES ($1, $2, $3)
         RETURNING id, full_name, specialty`,
        [doc.fullName, doc.specialty, doc.licenseCode]
      );
      const row = res.rows[0];
      if (row) {
        insertedDoctors.push({
          id: row.id,
          fullName: row.full_name,
          specialty: row.specialty,
        });
      }
    }

    // 3. Insertar pacientes
    console.log('[Seed] Insertando pacientes...');
    const insertedPatients: Array<{
      id: number;
      fullName: string;
      allergies: string;
      metabolicProfile: string;
    }> = [];
    for (const pat of PATIENTS_SEED) {
      const res = await pool.query<{
        id: number;
        full_name: string;
        allergies: string;
        metabolic_profile: string;
      }>(
        `INSERT INTO patients (document_id, full_name, allergies, metabolic_profile)
         VALUES ($1, $2, $3, $4)
         RETURNING id, full_name, allergies, metabolic_profile`,
        [pat.documentId, pat.fullName, pat.allergies, pat.metabolicProfile]
      );
      const row = res.rows[0];
      if (row) {
        insertedPatients.push({
          id: row.id,
          fullName: row.full_name,
          allergies: row.allergies,
          metabolicProfile: row.metabolic_profile,
        });
      }
    }

    // 4. Insertar fragmentos bibliográficos vectorizados (RAG) desde Libros.json
    console.log('[Seed] Insertando fragmentos bibliográficos vectorizados (RAG)...');
    const librosJsonPath = path.join(__dirname, '../INVESTIGACIONES/Libros.json');
    let booksToInsert: KnowledgeSeed[] = KNOWLEDGE_SEEDS;

    if (fs.existsSync(librosJsonPath)) {
      try {
        const rawJson = fs.readFileSync(librosJsonPath, 'utf-8');
        interface JsonBookItem {
          code: string;
          category: string;
          bookSource: string;
          keywords: string[];
          clinicalRule: string;
          content: string;
        }
        const jsonBooks = JSON.parse(rawJson) as JsonBookItem[];
        booksToInsert = jsonBooks.map((b) => ({
          code: b.code,
          category: b.category,
          bookSource: b.bookSource,
          content: `${b.clinicalRule}\n\n${b.content}`,
          keywords: b.keywords,
        }));
        console.log(`[Seed] Se cargaron exitosamente ${booksToInsert.length} libros médicos desde Libros.json.`);
      } catch (err) {
        console.warn('[Seed] Advertencia al leer Libros.json, usando semillas por defecto:', err);
      }
    }

    for (const item of booksToInsert) {
      const keywordsText = (item as { keywords?: string[] }).keywords?.join(' ') ?? '';
      const textForVector = `${item.content} ${keywordsText}`;
      const vector = buildClinicalVector(textForVector);
      await pool.query(
        `INSERT INTO clinical_knowledge (code, category, book_source, content, embedding_vector)
         VALUES ($1, $2, $3, $4, $5)`,
        [item.code, item.category, item.bookSource, item.content, JSON.stringify(vector)]
      );
    }

    // 5. Insertar 2 consultas iniciales
    console.log('[Seed] Insertando 2 consultas clínicas iniciales...');
    const doctorA = insertedDoctors[0];
    const doctorB = insertedDoctors[1];
    const patientA = insertedPatients[0];
    const patientB = insertedPatients[1];

    if (doctorA && doctorB && patientA && patientB) {
      // Consulta 1: Juan Pérez (Hígado graso) con Dr. Carlos Mendoza
      const symptoms1 =
        'Sensación de pesadez posprandial en hipocondrio derecho y marcada fatiga tras consumir jugo de naranja concentrado y dulces.';
      const temp1 = 36.8;
      const pain1 = 3;
      const indications1 = 'Paracetamol 500mg si hay malestar, continuar dieta habitual.';
      const vector1 = buildClinicalVector(symptoms1);
      const triage1 = evaluateTriagePriority(temp1, pain1, symptoms1);
      const alerts1 = auditMetabolicAndPharmacology({
        metabolicProfile: patientA.metabolicProfile,
        allergies: patientA.allergies,
        symptoms: symptoms1,
        proposedIndications: indications1,
      });
      const rag1 =
        '[Evidencia Clínica - EASL Clinical Practice Guidelines (EASL-NAFLD-01)]: La fructosa líquida y los azúcares concentrados sobrecargan de inmediato la lipogénesis de novo hepática, agravando la esteatohepatitis.';
      const soap1 = generateDeterministicSoap({
        patientName: patientA.fullName,
        doctorName: doctorA.fullName,
        symptoms: symptoms1,
        temperature: temp1,
        painLevel: pain1,
        triagePriority: triage1,
        metabolicProfile: patientA.metabolicProfile,
        allergies: patientA.allergies,
        metabolicAlerts: alerts1,
        ragContext: rag1,
        proposedIndications: indications1,
      });

      await pool.query(
        `INSERT INTO consultations (
          patient_id, doctor_id, symptoms, temperature, pain_level,
          proposed_indications, triage_priority, metabolic_alerts, rag_context,
          soap_draft, symptom_vector, doctor_notes, validated_by_doctor
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          patientA.id,
          doctorA.id,
          symptoms1,
          temp1,
          pain1,
          indications1,
          triage1,
          alerts1,
          rag1,
          soap1,
          JSON.stringify(vector1),
          'Paciente orientado respecto al consumo perjudicial de azúcares y fructosa.',
          true,
        ]
      );

      // Consulta 2: María Fernanda Salgado (Low-carb) con Dra. Elena Paredes
      const symptoms2 =
        'Cefalea matutina leve, sensación de mareo ortostático y astenia tras iniciar restricción severa de carbohidratos.';
      const temp2 = 36.6;
      const pain2 = 4;
      const indications2 = 'Hidratación abundante y reposo relativo.';
      const vector2 = buildClinicalVector(symptoms2);
      const triage2 = evaluateTriagePriority(temp2, pain2, symptoms2);
      const alerts2 = auditMetabolicAndPharmacology({
        metabolicProfile: patientB.metabolicProfile,
        allergies: patientB.allergies,
        symptoms: symptoms2,
        proposedIndications: indications2,
      });
      const rag2 =
        '[Evidencia Clínica - ADA Standards of Care (ADA-LOWCARB-02)]: Natriuresis por baja ingesta de carbohidratos: disminución de insulina induce excreción renal de sodio y agua. Obligatorio reponer sodio, potasio y magnesio.';
      const soap2 = generateDeterministicSoap({
        patientName: patientB.fullName,
        doctorName: doctorB.fullName,
        symptoms: symptoms2,
        temperature: temp2,
        painLevel: pain2,
        triagePriority: triage2,
        metabolicProfile: patientB.metabolicProfile,
        allergies: patientB.allergies,
        metabolicAlerts: alerts2,
        ragContext: rag2,
        proposedIndications: indications2,
      });

      await pool.query(
        `INSERT INTO consultations (
          patient_id, doctor_id, symptoms, temperature, pain_level,
          proposed_indications, triage_priority, metabolic_alerts, rag_context,
          soap_draft, symptom_vector, doctor_notes, validated_by_doctor
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          patientB.id,
          doctorB.id,
          symptoms2,
          temp2,
          pain2,
          indications2,
          triage2,
          alerts2,
          rag2,
          soap2,
          JSON.stringify(vector2),
          'Se prescribe reposición activa de electrolitos y agua mineralizada.',
          false,
        ]
      );
    }

    console.log('[Seed] ¡Datos iniciales cargados satisfactoriamente!');
  } catch (error) {
    console.error('[Seed] Error durante la ejecución del seed:', error);
  } finally {
    await pool.end();
  }
};

void runSeed();
