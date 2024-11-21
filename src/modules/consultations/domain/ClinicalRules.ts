import type { TriagePriority } from './Consultation.js';

const normalize = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const CRITICAL_SYMPTOM_KEYWORDS = [
  'dolor de pecho',
  'dolor toracico',
  'falta de aire',
  'disnea',
  'rigidez de nuca',
  'desmayo',
  'sincope',
  'perdida de conciencia',
  'convulsion',
  'hemorragia',
];

export const evaluateTriagePriority = (
  temperature: number,
  painLevel: number,
  symptoms: string
): TriagePriority => {
  if (temperature >= 38.5) {
    return 'URGENT';
  }

  if (painLevel >= 8) {
    return 'URGENT';
  }

  const normalizedSymptoms = normalize(symptoms);
  const hasCriticalSymptom = CRITICAL_SYMPTOM_KEYWORDS.some((kw) =>
    normalizedSymptoms.includes(kw)
  );

  return hasCriticalSymptom ? 'URGENT' : 'NORMAL';
};

interface AuditParams {
  metabolicProfile: string;
  allergies: string;
  symptoms: string;
  proposedIndications: string;
}

export const auditMetabolicAndPharmacology = ({
  metabolicProfile,
  allergies,
  symptoms,
  proposedIndications,
}: AuditParams): string => {
  const alerts: string[] = [];
  const normProfile = normalize(metabolicProfile);
  const normAllergies = normalize(allergies);
  const normSymptoms = normalize(symptoms);
  const normIndications = normalize(proposedIndications);
  const combinedContext = `${normSymptoms} ${normIndications}`;

  // 1. Alerta Hígado Graso / Hepatopatía / Sobrecarga de Fructosa o Paracetamol
  const isFattyLiver =
    normProfile.includes('higado graso') ||
    normProfile.includes('esteatosis') ||
    normProfile.includes('hepat');
  if (isFattyLiver) {
    if (
      combinedContext.includes('naranja') ||
      combinedContext.includes('fructosa') ||
      combinedContext.includes('jugo') ||
      combinedContext.includes('azucar') ||
      combinedContext.includes('dulce')
    ) {
      alerts.push(
        '[ALERTA METABÓLICA HEPÁTICA] Paciente con esteatosis hepática / hígado graso: la fructosa líquida y azúcares simples sobrecargan la lipogénesis de novo en hepatocitos. Se recomienda suspender jugos, frutas ricas en fructosa y azúcares refinados.'
      );
    }
    if (combinedContext.includes('paracetamol') || combinedContext.includes('acetaminofen')) {
      alerts.push(
        '[PRECAUCIÓN FARMACOLÓGICA HEPÁTICA] Paciente con compromiso hepático previo: restringir dosis máxima de paracetamol para evitar hepatotoxicidad.'
      );
    }
  }

  // 2. Alerta Dieta Cetogénica / Baja en Carbohidratos (Low-Carb) y Natriuresis Insulínica
  const isKetoOrLowCarb =
    normProfile.includes('keto') ||
    normProfile.includes('cetogen') ||
    normProfile.includes('low-carb') ||
    normProfile.includes('baja en carbohidratos');
  if (isKetoOrLowCarb) {
    alerts.push(
      '[ALERTA METABÓLICA ELECTROLÍTICA] Paciente en protocolo cetogénico/low-carb: la caída rápida de insulinemia provoca natriuresis renal aumentada. Se prescribe obligatoriamente hidratación oral de al menos 2.5 L/día y reposición de electrolitos (sodio, potasio, citrato de magnesio) para evitar astenia y cefalea.'
    );
  }

  // 3. Alerta Dislipidemia / Colesterol LDL Elevado / Grasas Saturadas
  const isDyslipidemia =
    normProfile.includes('dislipidemia') ||
    normProfile.includes('ldl') ||
    normProfile.includes('colesterol') ||
    normProfile.includes('trigliceridos');
  if (isDyslipidemia) {
    if (
      combinedContext.includes('grasa saturada') ||
      combinedContext.includes('embutido') ||
      combinedContext.includes('fritura') ||
      combinedContext.includes('ultraprocesado')
    ) {
      alerts.push(
        '[ALERTA METABÓLICA LIPÍDICA] Paciente con perfil lipídico alterado (LDL/triglicéridos): contraindicado consumo de ácidos grasos saturados, grasas trans y ultraprocesados. Indicar perfil lipídico completo de control en 6 semanas.'
      );
    }
  }

  // 4. Alerta Resistencia a la Insulina / Diabetes Mellitus
  const isInsulinResistant =
    normProfile.includes('resistencia a la insulina') ||
    normProfile.includes('diabetes') ||
    normProfile.includes('hba1c');
  if (isInsulinResistant) {
    if (
      combinedContext.includes('carbohidrato simple') ||
      combinedContext.includes('pan blanco') ||
      combinedContext.includes('gaseosa') ||
      combinedContext.includes('dulces')
    ) {
      alerts.push(
        '[ALERTA METABÓLICA GLUCÉMICA] Paciente con desregulación de glucosa/resistencia insulínica: restringir índice glucémico alto; priorizar fibra soluble y actividad física posprandial.'
      );
    }
  }

  // 5. Cruce Farmacológico Directo contra Alergias del Paciente
  if (normAllergies !== 'ninguna' && normAllergies.length > 0) {
    const allergyKeywords: Array<{ trigger: string; medicines: string[]; label: string }> = [
      {
        trigger: 'penicilina',
        medicines: ['penicilina', 'amoxicilina', 'ampicilina', 'amoxi', 'clavulanico'],
        label: 'Betalactámicos / Penicilinas',
      },
      {
        trigger: 'sulfas',
        medicines: ['sulfa', 'cotrimoxazol', 'trimetoprima', 'sulfametoxazol'],
        label: 'Sulfonamidas',
      },
      {
        trigger: 'aines',
        medicines: ['aspirina', 'ibuprofeno', 'naproxeno', 'diclofenaco', 'ketorolaco', 'meloxicam'],
        label: 'Antiinflamatorios no esteroideos (AINEs)',
      },
      {
        trigger: 'ibuprofeno',
        medicines: ['ibuprofeno', 'advil', 'motrin'],
        label: 'Ibuprofeno',
      },
      {
        trigger: 'aspirina',
        medicines: ['aspirina', 'acido acetilsalicilico'],
        label: 'Ácido acetilsalicílico',
      },
    ];

    for (const item of allergyKeywords) {
      if (normAllergies.includes(item.trigger)) {
        for (const med of item.medicines) {
          if (normIndications.includes(med)) {
            alerts.push(
              `[ALERTA FARMACOLÓGICA GRAVE] Conflicto directo de alergia: El paciente tiene antecedente registrado de hipersensibilidad a ${item.label}. Se ha detectado "${med}" en las indicaciones propuestas. Suspender de inmediato y reemplazar por alternativa segura.`
            );
            break;
          }
        }
      }
    }
  }

  if (alerts.length === 0) {
    return 'Sin alertas metabólicas críticas ni contraindicaciones farmacológicas detectadas para este paciente.';
  }

  return alerts.join('\n\n');
};
