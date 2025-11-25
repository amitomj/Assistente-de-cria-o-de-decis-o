import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
// @ts-ignore
import FileSaver from "file-saver";
import { CaseData } from "../types";

// Helper function to split text by newlines and create separate paragraphs
const createParagraphsFromText = (text: string, options: { spacing?: { before?: number; after?: number }; alignment?: AlignmentType } = {}) => {
    if (!text) return [new Paragraph({ text: "" })];
    
    // Split by single or multiple newlines
    const lines = text.split(/\r?\n/);
    
    return lines.map((line, index) => {
        // Skip purely empty lines if you don't want extra spacing, 
        // OR keep them to reflect user's manual spacing (e.g. double enter).
        // Here we keep them but ensure they have height if they are empty
        const isLast = index === lines.length - 1;
        const txt = line.trim();
        
        return new Paragraph({
            children: [new TextRun(line)], // Keep original line content including leading spaces if needed, or trim()
            alignment: options.alignment || AlignmentType.JUSTIFIED,
            spacing: { 
                before: options.spacing?.before || 0,
                after: options.spacing?.after || (txt === "" ? 0 : 120) // Give some space after text paragraphs
            },
        });
    });
};

export const generateDocx = async (data: CaseData) => {
  let resourceCounter = 0;

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header
          new Paragraph({
            text: "PROJETO DE ACÓRDÃO",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // I - Relatório
          new Paragraph({
            text: "I - RELATÓRIO",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          ...createParagraphsFromText(data.report),

          // Insert Appeals Conclusions
          new Paragraph({
            text: "As conclusões das alegações de recurso são as seguintes:",
            spacing: { before: 200, after: 100 },
            italics: true,
          }),

          ...data.appealConclusions.flatMap(ac => {
            const paragraphs: Paragraph[] = [];
            
            // If it's a new Appeal (Recurso), add a numbered heading
            if (ac.type === 'RECURSO') {
              resourceCounter++;
              paragraphs.push(
                new Paragraph({
                  text: `Recurso ${resourceCounter}`,
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 400, after: 100 },
                  keepNext: true,
                })
              );
            }

            // Source identification (e.g., Recorrente: ...)
            paragraphs.push(
              new Paragraph({
                text: ac.source, // Use source directly as it now contains "Recorrente X" or "Recorrido Y"
                bold: true,
                spacing: { before: 200 },
                keepNext: true,
              })
            );

            // Content paragraphs
            paragraphs.push(...createParagraphsFromText(ac.content));

            return paragraphs;
          }),

          // II - Fundamentação
          new Paragraph({
            text: "II - FUNDAMENTAÇÃO DE FACTO",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "A 1ª instância considerou provados os seguintes factos:",
            spacing: { after: 200 },
          }),
          ...createParagraphsFromText(data.provenFacts),

          new Paragraph({
            text: "Factos não provados:",
            bold: true,
            spacing: { before: 200, after: 100 },
          }),
           ...createParagraphsFromText(data.unprovenFacts || "Nada a consignar."),

          // III - Direito (Placeholder)
          new Paragraph({
            text: "III - FUNDAMENTAÇÃO DE DIREITO",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "[Inserir fundamentação jurídica aqui]",
            italics: true,
            color: "808080",
          }),

          // IV - Decisão
          new Paragraph({
            text: "IV - DECISÃO",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "Pelo exposto, acordam os juízes desta secção em...",
            italics: true,
          }),
          new Paragraph({
            text: "(Decisão recorrida para referência: " + data.decisionFirstInstance + ")",
            spacing: { before: 200 },
            color: "808080",
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  // Robustly handle file-saver export (can be default function or object with saveAs)
  const saveAs = (FileSaver as any).saveAs || FileSaver;
  saveAs(blob, "Projeto_Acordao.docx");
};