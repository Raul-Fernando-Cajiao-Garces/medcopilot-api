import type { SoapGenerationParams } from '../../ports/ClinicalCopilotPort.js';

export const generateDeterministicSoap = (params: SoapGenerationParams): string => {
  const subjective = [
    `Paciente ${params.patientName} refiere el siguiente motivo de consulta y sintomatología: "${params.symptoms}".`,
    `Escala subjetiva de dolor EVA reportada: ${params.painLevel}/10. Días de evolución de los síntomas: ${params.dias ?? 1} días.`,
    `Antecedentes metabólicos basales: ${params.metabolicProfile}. Alergias documentadas: ${params.allergies}.`,
  ].join(' ');

  const objective = [
    `Signos vitales y examen físico inicial: Temperatura corporal registrada: ${params.temperature}°C.`,
    `Nivel de triaje clínico asignado: [${params.triagePriority}].`,
    `Médico evaluador: Dr(a). ${params.doctorName}.`,
  ].join(' ');

  const analysis = [
    `Evaluación sindrómica y correlación RAG:`,
    `- Auditoría Metabólica: ${params.metabolicAlerts}`,
    `- Evidencia clínica y antecedentes previos recuperados (RAG): ${params.ragContext || 'Sin antecedentes ni citas previas similares.'}`,
  ].join('\n');

  const plan = [
    `Indicaciones y conducta médica propuesta:`,
    `- Esquema inicial: ${params.proposedIndications || 'Reposo, control de signos de alarma e hidratación.'}`,
    `- Monitoreo: Reevaluación según evolución y signos de bandera roja.`,
    `- Validación clínica pendiente por el profesional a cargo.`,
  ].join('\n');

  return [
    `[S - SUBJETIVO]`,
    subjective,
    ``,
    `[O - OBJETIVO]`,
    objective,
    ``,
    `[A - ANÁLISIS CLÍNICO Y RAG]`,
    analysis,
    ``,
    `[P - PLAN TERAPÉUTICO SUGERIDO]`,
    plan,
  ].join('\n');
};
