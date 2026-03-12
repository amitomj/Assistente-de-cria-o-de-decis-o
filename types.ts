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

export interface StyleConfig {
  font: string;
  size: number;
  bold: boolean;
  italics: boolean;
  alignment: 'JUSTIFIED' | 'LEFT' | 'CENTER' | 'RIGHT';
  indentLeft: number; // in mm
  indentRight: number; // in mm
  indentFirstLine: number; // in mm
  spacingBefore: number; // in points
  spacingAfter: number; // in points
  lineSpacing: number; // 240 = single, 360 = 1.5, 480 = double
}

export interface TemplateSettings {
  name: string;
  normal: StyleConfig;
  heading1: StyleConfig;
  heading2: StyleConfig;
  heading3: StyleConfig;
  heading4: StyleConfig;
  heading5: StyleConfig;
  citation: StyleConfig;
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
  appealQuestions: string;
  impugnedFacts: string;
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