import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from "@google/genai";
import { CaseData, AppealPair } from "../types";
import mammoth from "mammoth";

// Helper to convert File to Part (handling .docx conversion)
const fileToPart = async (file: File): Promise<any> => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  // Special handling for .docx since Gemini API doesn't support it directly
  if (ext === 'docx') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Use convertToHtml to preserve some structural/style information for the AI
      const result = await mammoth.convertToHtml({ arrayBuffer });
      return { 
        text: `[CONTEÚDO DO DOCUMENTO DOCX (Convertido para HTML para preservação de estrutura)]:\n${result.value}` 
      };
    } catch (error) {
      console.error("Erro ao converter DOCX:", error);
      // Fallback to raw text if HTML conversion fails
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return { text: `[CONTEÚDO DO DOCUMENTO DOCX (Texto Simples)]:\n${result.value}` };
    }
  }

  return new Promise<any>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      
      // Robust MIME type fallback
      let mimeType = file.type;
      if (!mimeType) {
        if (ext === 'pdf') mimeType = 'application/pdf';
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
  apiKey: string,
  sentenceFile: File,
  appealPairs: AppealPair[]
): Promise<CaseData> => {
  try {
    if (!apiKey) throw new Error("API Key em falta.");
    
    const ai = new GoogleGenAI({ apiKey: apiKey });

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
      (SE HOUVER TABELAS: Converta-as para tabelas Markdown visualmente alinhadas. TUDO o que for tabela deve ser formatado rigorosamente assim:
      | Coluna 1 | Coluna 2 |
      |---|---|
      | Dado A | Dado B |
      
      IMPORTANTE: Todas as linhas da tabela DEVEM começar e terminar com '|'.)

      <<<FACTOS_NAO_PROVADOS>>>
      (Copie integralmente os factos não provados, se houver.)

      <<<DECISAO_PRIMEIRA_INSTANCIA>>>
      (O segmento decisório/dispositivo da sentença da primeira instância.)

      <<<CONCLUSOES_RECURSOS>>>
      (Liste as conclusões. Mantenha a ordem cronológica dos recursos.)
      (IMPORTANTE: Para cada recurso identificado, extraia PRIMEIRO as conclusões do recurso e, IMEDIATAMENTE DEPOIS, as conclusões da resposta/contra-alegações correspondente, se houver. Se a resposta/contra-alegação não tiver conclusões explícitas, forneça um resumo claro da posição assumida quanto às várias questões suscitadas no recurso.)
      
      (Utilize este formato exato para CADA item:)
      TIPO: (Escreva apenas "RECURSO" ou "RESPOSTA")
      FONTE: (Ex: "Recorrente: Autor João" ou "Recorrido: Réu Empresa X")
      CONTEUDO: (Copie as conclusões ou forneça o resumo se for uma resposta sem conclusões. IMPORTANTE: Se as conclusões estiverem amontoadas num único parágrafo no texto original, separe-as obrigatoriamente por parágrafos, garantindo que cada número romano (I, II, III...), número (1., 2...) ou alínea (a), b)...) comece numa nova linha.)
      ---SEPARADOR_ITEM---

      <<<QUESTOES_A_DECIDIR>>>
      (Interprete APENAS as conclusões dos recursos - ignore as respostas/contra-alegações para esta secção - e indique, por tópicos, as questões suscitadas que o tribunal deve decidir. Indique expressamente todos os pontos da matéria de facto que são objeto de impugnação.)
      (Apresente o texto EXATAMENTE neste modelo, sem o texto introdutório legal que será adicionado automaticamente:)
      Recurso 1
      - questão a
      - questão b
      Recurso 2
      - questão a
      - questão b

      <<<FACTOS_IMPUGNADOS>>>
      (Indique todos os pontos da matéria de facto objeto de impugnação nos recursos.)
      
      <<<IMAGENS>>>
      (Se existirem imagens/figuras no meio dos factos provados, descreva-as aqui brevemente indicando a sua posição original, pois não consigo copiar imagens diretamente.)
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
    const appealQuestions = extractSection('<<<QUESTOES_A_DECIDIR>>>');
    const impugnedFacts = extractSection('<<<FACTOS_IMPUGNADOS>>>');
    
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
      appealConclusions: appealConclusions.length > 0 ? appealConclusions : [{ type: 'RECURSO', source: "Sistema", content: "Não foram encontradas conclusões explícitas." }],
      appealQuestions: appealQuestions || "Não foi possível identificar as questões a decidir.",
      impugnedFacts: impugnedFacts || "Não foi identificada impugnação da matéria de facto."
    };

  } catch (error) {
    console.error("Erro na extração:", error);
    throw error;
  }
};