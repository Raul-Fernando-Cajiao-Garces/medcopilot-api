import type {
  ClinicalCopilotPort,
  SoapGenerationParams,
} from '../../ports/ClinicalCopilotPort.js';
import { generateDeterministicSoap } from './deterministicSoapGenerator.js';

export const createInMemoryClinicalCopilotAdapter = (): ClinicalCopilotPort => {
  const generateSoapDraft = async (params: SoapGenerationParams): Promise<string> => {
    return generateDeterministicSoap(params);
  };

  return {
    generateSoapDraft,
  };
};
