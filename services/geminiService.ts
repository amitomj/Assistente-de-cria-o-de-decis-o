import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { CaseData, AppealPair } from "../types";

// Helper to convert File to Base64
const fileToPart = async (file: File) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      
      // Robust MIME type fallback
      let mimeType = file.type;
      if (!mimeType) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') mimeType = 'application/pdf';
        else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (ext === 'txt') mimeType = 'text/plain';
      }

      // Default to pdf if still unknown (common for some legal docs), or let API decide/fail
      if (!mimeType) mimeType = 'application/pdf';

      resolve({
        inlineData: {
          data: base64String,
          mimeType: mimeType,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const extractCaseData = async (
  sentenceFile: File,
  appealPairs: AppealPair[]
): Promise<CaseData> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Prepare parts
    const parts: any[] = [];

    // Add Sentence
    const sentencePart = await fileToPart(sentenceFile);
    parts.push(sentencePart);
    parts.push({ text: "O documento acima é a Sentença de Primeira Instância. Identifique-a como tal." });

    // Add Appeals and Responses
    for (const pair of appealPairs) {
      if (pair.appeal) {
        const appealPart = await fileToPart(pair.appeal);
        parts.push(appealPart);
        parts.push({ text: "O documento acima é um Recurso (Alegações). Extraia as Conclusões." });
      }
      if (pair.response) {
        const responsePart = await fileToPart(pair.response);
        parts.push(responsePart);
        parts.push({ text: "O documento acima é uma Resposta ao Recurso (Contra-alegações)." });
      }
    }

    // New Prompt Strategy: Structured Text instead of JSON
    // JSON is prone to truncation and escaping errors with large legal texts.
    const systemInstruction = `
      Você é um Assistente Jurídico de alto nível em um Tribunal Superior.
      Sua tarefa é analisar os documentos fornecidos (Sentença, Recursos e Respostas) e estruturar um projeto de Acórdão.
      
      IMPORTANTE:
      Não responda em JSON. Responda em TEXTO ESTRUTURADO usando EXATAMENTE as tags abaixo como separadores.
      Copie os textos com fidelidade total.
      
      ESTRUTURA DA RESPOSTA:

      <<<RELATORIO>>>
      (Sintetize o histórico do processo. Separe os parágrafos claramente com quebras de linha duplas.)

      <<<FACTOS_PROVADOS>>>
      (Copie integralmente os factos provados da sentença. Mantenha a numeração original.)
      (SE HOUVER TABELAS: Converta-as para tabelas Markdown visualmente alinhadas. Ex: | Col1 | Col2 |)

      <<<FACTOS_NAO_PROVADOS>>>
      (Copie integralmente os factos não provados, se houver.)

      <<<DECISAO_PRIMEIRA_INSTANCIA>>>
      (O segmento decisório/dispositivo da sentença da primeira instância.)

      <<<CONCLUSOES_RECURSOS>>>
      (Liste as conclusões. Mantenha a ordem cronológica dos recursos.)
      (IMPORTANTE: Para cada recurso identificado, extraia PRIMEIRO as conclusões do recurso e, IMEDIATAMENTE DEPOIS, as conclusões da resposta/contra-alegações correspondente, se houver.)
      
      (Utilize este formato exato para CADA item:)
      TIPO: (Escreva apenas "RECURSO" ou "RESPOSTA")
      FONTE: (Ex: "Recorrente: Autor João" ou "Recorrido: Réu Empresa X")
      CONTEUDO: (Copie as conclusões numeradas)
      ---SEPARADOR_ITEM---
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts }],
      config: {
        systemInstruction,
        // Removed responseMimeType: 'application/json' to allow robust text generation
        maxOutputTokens: 65536,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      },
    });

    const text = response.text || "";
    
    // Robust Custom Parsing
    const extractSection = (tag: string): string => {
      const parts = text.split(tag);
      if (parts.length < 2) return "";
      // content is everything until the next '<<<' tag or end of string
      const content = parts[1].split('<<<')[0];
      return content.trim();
    };

    const report = extractSection('<<<RELATORIO>>>');
    const provenFacts = extractSection('<<<FACTOS_PROVADOS>>>');
    const unprovenFacts = extractSection('<<<FACTOS_NAO_PROVADOS>>>');
    const decisionFirstInstance = extractSection('<<<DECISAO_PRIMEIRA_INSTANCIA>>>');
    
    const conclusionsRaw = extractSection('<<<CONCLUSOES_RECURSOS>>>');
    
    let appealConclusions: { type: 'RECURSO' | 'RESPOSTA'; source: string; content: string }[] = [];
    
    if (conclusionsRaw) {
      appealConclusions = conclusionsRaw
        .split('---SEPARADOR_ITEM---')
        .map(block => {
          block = block.trim();
          if (!block) return null;
          
          // Try to extract type and source
          const typeMatch = block.match(/TIPO:(.*?)(\n|$)/);
          const sourceMatch = block.match(/FONTE:(.*?)(\n|$)/);
          
          let type = typeMatch ? typeMatch[1].trim().toUpperCase() : 'RECURSO';
          // Normalize type
          if (!['RECURSO', 'RESPOSTA'].includes(type)) type = 'RECURSO';

          const source = sourceMatch ? sourceMatch[1].trim() : "Parte não identificada";
          
          // Extract content
          let content = block
            .replace(/TIPO:.*(\n|$)/, '')
            .replace(/FONTE:.*(\n|$)/, '')
            .replace(/CONTEUDO:\s*/i, '')
            .trim();
            
          return { type: type as 'RECURSO' | 'RESPOSTA', source, content };
        })
        .filter(item => item !== null) as { type: 'RECURSO' | 'RESPOSTA'; source: string; content: string }[];
    }

    // Validation
    if (!report && !provenFacts) {
      console.error("Full text received:", text);
      throw new Error("O modelo gerou uma resposta, mas não foi possível identificar as seções esperadas. (Falha nas tags delimitadoras)");
    }

    return {
      report: report || "Não foi possível extrair o relatório.",
      provenFacts: provenFacts || "Não foi possível extrair os factos provados.",
      unprovenFacts: unprovenFacts || "Nada a consignar.",
      decisionFirstInstance: decisionFirstInstance || "Não foi possível extrair a decisão.",
      appealConclusions: appealConclusions.length > 0 ? appealConclusions : [{ type: 'RECURSO', source: "Sistema", content: "Não foram encontradas conclusões explícitas." }]
    };

  } catch (error) {
    console.error("Erro na extração:", error);
    throw error;
  }
};