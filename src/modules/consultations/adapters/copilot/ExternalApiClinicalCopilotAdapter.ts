import type {
  ClinicalCopilotPort,
  SoapGenerationParams,
} from '../../ports/ClinicalCopilotPort.js';
import { generateDeterministicSoap } from './deterministicSoapGenerator.js';

interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAiChatChoice {
  index?: number;
  message?: OpenAiChatMessage;
}

interface OpenAiChatResponse {
  choices?: OpenAiChatChoice[];
  text?: string;
  response?: string;
}

export const createExternalApiClinicalCopilotAdapter = (
  apiUrl?: string,
  apiKey?: string,
  model?: string
): ClinicalCopilotPort => {
  const targetUrl = apiUrl || process.env['AI_API_URL'];
  const targetKey = apiKey || process.env['AI_API_KEY'];
  const targetModel = model || process.env['AI_MODEL'] || 'openai/gpt-oss-120b';

  const buildSystemPrompt = (): string => {
    return [
      'Eres MedCopilot, un asistente médico clínico-metabólico de alta precisión para profesionales de salud.',
      'Tu tarea es redactar un borrador de historia clínica SOAP conciso (menos de 250 palabras) en exactamente 4 secciones:',
      '[S - SUBJETIVO]',
      '[O - OBJETIVO]',
      '[A - ANÁLISIS CLÍNICO Y RAG]',
      '[P - PLAN TERAPÉUTICO SUGERIDO]',
      'Usa un tono clínico formal, riguroso y en español. Integra de forma explícita las alertas metabólicas y la evidencia bibliográfica RAG provista.',
    ].join('\n');
  };

  const buildUserPrompt = (params: SoapGenerationParams): string => {
    return [
      `Paciente: ${params.patientName}. Alergias: ${params.allergies}. Perfil metabólico: ${params.metabolicProfile}.`,
      `Médico tratante: ${params.doctorName}. Motivo de consulta / Síntomas: ${params.symptoms}. Días de evolución: ${params.dias ?? 1} días.`,
      `Signos vitales: Temp: ${params.temperature}°C. Escala de dolor EVA: ${params.painLevel}/10. Nivel de triaje: ${params.triagePriority}.`,
      `Auditoría metabólica y farmacológica detectada:\n${params.metabolicAlerts}`,
      `Evidencia RAG recuperada de libros médicos de referencia:\n${params.ragContext || 'Sin antecedentes ni evidencia previa requerida.'}`,
      `Indicaciones y conducta médica propuesta: ${params.proposedIndications || 'Pendientes de evaluación médica directa.'}`,
    ].join('\n');
  };

  const generateSoapDraft = async (params: SoapGenerationParams): Promise<string> => {
    if (!targetUrl || targetUrl.trim().length === 0 || !targetKey || targetKey.trim().length === 0) {
      return generateDeterministicSoap(params);
    }

    try {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(params);

      const requestBody = {
        model: targetModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${targetKey.trim()}`,
      };

      const response = await fetch(targetUrl.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        console.warn(`[MedCopilot AI] La API de IA respondió con status ${response.status}. Activando generador determinista de respaldo.`);
        return generateDeterministicSoap(params);
      }

      const data = (await response.json()) as OpenAiChatResponse;
      const generatedContent =
        data.choices?.[0]?.message?.content ?? data.text ?? data.response;

      if (
        generatedContent &&
        typeof generatedContent === 'string' &&
        generatedContent.trim().length > 0
      ) {
        return generatedContent.trim();
      }

      return generateDeterministicSoap(params);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.warn(`[MedCopilot AI] Timeout o fallo de red en API de IA (${msg}). Activando respaldo determinista.`);
      return generateDeterministicSoap(params);
    }
  };

  return {
    generateSoapDraft,
  };
};
