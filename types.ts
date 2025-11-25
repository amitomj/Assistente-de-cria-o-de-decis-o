export interface DocumentFile {
  file: File;
  type: 'SENTENCE' | 'APPEAL' | 'RESPONSE';
  id: string;
}

export interface AppealPair {
  id: string;
  appeal: File | null;
  response: File | null;
}

export interface CaseData {
  report: string;
  provenFacts: string;
  unprovenFacts: string;
  decisionFirstInstance: string;
  appealConclusions: Array<{
    type: 'RECURSO' | 'RESPOSTA';
    source: string;
    content: string;
  }>;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  REVIEW = 'REVIEW',
  ERROR = 'ERROR'
}

export interface ProcessingError {
  message: string;
}