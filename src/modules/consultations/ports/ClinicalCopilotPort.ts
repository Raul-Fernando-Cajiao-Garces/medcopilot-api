export interface SoapGenerationParams {
  patientName: string;
  doctorName: string;
  symptoms: string;
  temperature: number;
  painLevel: number;
  triagePriority: string;
  metabolicProfile: string;
  allergies: string;
  metabolicAlerts: string;
  ragContext: string;
  proposedIndications: string;
}

export interface ClinicalCopilotPort {
  generateSoapDraft: (params: SoapGenerationParams) => Promise<string>;
}
