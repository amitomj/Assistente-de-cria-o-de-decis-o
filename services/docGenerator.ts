import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LineRuleType, Table, TableRow, TableCell, BorderStyle, WidthType, TableLayoutType } from "docx";
// @ts-ignore
import FileSaver from "file-saver";
import { CaseData, TemplateSettings, StyleConfig } from "../types";

// Helper function to convert millimeters to twips (1/20th of a point)
// 1 inch = 25.4 mm = 1440 twips
const convertMillimetersToTwips = (millimeters: number): number => {
    return Math.round((millimeters / 25.4) * 1440);
};

const getAlignment = (align: string) => {
  switch (align) {
    case 'CENTER': return AlignmentType.CENTER;
    case 'RIGHT': return AlignmentType.RIGHT;
    case 'JUSTIFIED': return AlignmentType.JUSTIFIED;
    default: return AlignmentType.LEFT;
  }
};

const getStyleProps = (config: StyleConfig) => ({
  alignment: getAlignment(config.alignment),
  indent: { 
    left: convertMillimetersToTwips(config.indentLeft),
    right: convertMillimetersToTwips(config.indentRight),
    firstLine: convertMillimetersToTwips(config.indentFirstLine) 
  },
  spacing: { 
    before: config.spacingBefore * 20, 
    after: config.spacingAfter * 20, 
    line: config.lineSpacing, 
    lineRule: LineRuleType.AUTO 
  },
});

const getRunProps = (config: StyleConfig) => ({
  font: config.font,
  size: config.size * 2,
  bold: config.bold,
  italics: config.italics,
});

// HELPER: Parses text content, handling markdown tables, lists, and fixing broken sentences
const parseContent = (text: string, style: string = "Normal", bold: boolean = false): (Paragraph | Table)[] => {
    if (!text) return [new Paragraph({ text: "", style: style })];
    
    const children: (Paragraph | Table)[] = [];
    // Split by newlines
    const lines = text.split(/\r?\n/);
    
    let tableBuffer: string[] = [];
    let textBuffer: string[] = []; 

    const flushTable = () => {
        if (tableBuffer.length > 0) {
            flushText(); // Ensure text before table is written
            children.push(createTableFromMarkdown(tableBuffer, style));
            tableBuffer = [];
        }
    };

    const flushText = () => {
        if (textBuffer.length > 0) {
            // Join lines with space to "heal" broken sentences
            const paragraphText = textBuffer.join(" ");
            children.push(new Paragraph({
                children: [new TextRun({ text: paragraphText.trim(), bold: bold })],
                style: style,
            }));
            textBuffer = [];
        }
    };

    const isTableLine = (line: string) => {
        const trimmed = line.trim();
        // Strict check: must start and end with pipe
        return trimmed.startsWith('|') && trimmed.endsWith('|');
    };

    // Regex to detect list items (e.g., "1.", "1)", "a)", "-", "*", "I.")
    // This prevents merging a list item into the previous paragraph
    const isListItem = (line: string) => {
        const trimmed = line.trim();
        return /^[0-9]+[\.\)]\s/.test(trimmed) || 
               /^[a-zA-Z][\.\)]\s/.test(trimmed) || 
               /^[IVXLCDM]+[\.\)]\s/i.test(trimmed) || 
               /^[\-\*•]\s/.test(trimmed);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (isTableLine(line)) {
            flushText(); 
            tableBuffer.push(line);
        } else {
            flushTable(); 
            
            if (line === "") {
                // Empty line is a definitive paragraph break
                flushText();
            } else {
                // If it looks like a new list item, flush previous text to start a new paragraph
                if (isListItem(line) && textBuffer.length > 0) {
                    flushText();
                }
                textBuffer.push(line);
            }
        }
    }
    
    flushTable();
    flushText();

    return children;
};

// HELPER: Converts markdown table strings into a docx Table object
const createTableFromMarkdown = (rows: string[], style: string = "Normal"): Table => {
    // Filter out separator rows (e.g., |---|---|)
    const dataRows = rows.filter(row => !row.match(/^\|\s*:?-+:?\s*\|/));
    
    const fontSize = style === "Citation" ? 22 : 24;
    const italics = style === "Citation";

    const tableRows = dataRows.map(rowStr => {
        // Remove first and last pipe and split by pipe
        // | Cell 1 | Cell 2 | -> [" Cell 1 ", " Cell 2 "]
        const cells = rowStr.replace(/^\|/, '').replace(/\|$/, '').split('|');
        
        return new TableRow({
            children: cells.map(cellText => {
                return new TableCell({
                    children: [new Paragraph({
                        text: cellText.trim(),
                        // Explicit formatting per request:
                        // Calibri Light, Justified
                        // Indent: 0 (Interior/Exterior/Special None)
                        // Spacing: Before/After 0, Single line spacing
                        run: {
                            font: "Calibri Light",
                            size: fontSize,
                            italics: italics,
                        },
                        alignment: AlignmentType.JUSTIFIED,
                        indent: {
                            left: 0,
                            right: 0,
                            firstLine: 0,
                            hanging: 0
                        },
                        spacing: {
                            before: 0,
                            after: 0,
                            line: 240, // Single spacing
                            lineRule: LineRuleType.AUTO
                        }
                    })],
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    },
                    margins: {
                        top: convertMillimetersToTwips(1),
                        bottom: convertMillimetersToTwips(1),
                        left: convertMillimetersToTwips(1),
                        right: convertMillimetersToTwips(1),
                    },
                    width: {
                        size: 100 / cells.length,
                        type: WidthType.PERCENTAGE
                    }
                });
            })
        });
    });

    return new Table({
        rows: tableRows,
        layout: TableLayoutType.AUTOFIT,
        width: {
            size: 100,
            type: WidthType.PERCENTAGE,
        }
    });
};

export const generateDocx = async (data: CaseData, template?: TemplateSettings) => {
  let resourceCounter = 0;

  const defaultTemplate: TemplateSettings = {
    name: "Padrão",
    normal: {
      font: "Calibri Light",
      size: 12,
      bold: false,
      italics: false,
      alignment: 'JUSTIFIED',
      indentLeft: 0,
      indentRight: 0,
      indentFirstLine: 10,
      spacingBefore: 0,
      spacingAfter: 0,
      lineSpacing: 360,
    },
    heading1: {
      font: "Calibri Light",
      size: 14,
      bold: true,
      italics: false,
      alignment: 'CENTER',
      indentLeft: 0,
      indentRight: 0,
      indentFirstLine: 0,
      spacingBefore: 0,
      spacingAfter: 20,
      lineSpacing: 360,
    },
    heading2: {
      font: "Calibri Light",
      size: 14,
      bold: true,
      italics: false,
      alignment: 'JUSTIFIED',
      indentLeft: 0,
      indentRight: 0,
      indentFirstLine: 0,
      spacingBefore: 0,
      spacingAfter: 0,
      lineSpacing: 360,
    },
    heading3: {
      font: "Calibri Light",
      size: 12,
      bold: true,
      italics: false,
      alignment: 'JUSTIFIED',
      indentLeft: 0,
      indentRight: 0,
      indentFirstLine: 0,
      spacingBefore: 0,
      spacingAfter: 0,
      lineSpacing: 360,
    },
    heading4: {
      font: "Calibri Light",
      size: 12,
      bold: true,
      italics: true,
      alignment: 'JUSTIFIED',
      indentLeft: 0,
      indentRight: 0,
      indentFirstLine: 0,
      spacingBefore: 0,
      spacingAfter: 0,
      lineSpacing: 360,
    },
    heading5: {
      font: "Calibri Light",
      size: 12,
      bold: false,
      italics: true,
      alignment: 'JUSTIFIED',
      indentLeft: 0,
      indentRight: 0,
      indentFirstLine: 0,
      spacingBefore: 0,
      spacingAfter: 0,
      lineSpacing: 360,
    },
    citation: {
      font: "Calibri Light",
      size: 11,
      bold: false,
      italics: true,
      alignment: 'JUSTIFIED',
      indentLeft: 40,
      indentRight: 0,
      indentFirstLine: 0,
      spacingBefore: 0,
      spacingAfter: 0,
      lineSpacing: 360,
    }
  };

  const settings = template ? { ...defaultTemplate, ...template } : defaultTemplate;

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: getRunProps(settings.normal),
          paragraph: getStyleProps(settings.normal),
        },
        {
          id: "Citation",
          name: "Citation",
          run: getRunProps(settings.citation),
          paragraph: getStyleProps(settings.citation),
        },
        {
          id: "Heading1",
          name: "Heading 1",
          run: getRunProps(settings.heading1),
          paragraph: getStyleProps(settings.heading1),
        },
        {
          id: "Heading2",
          name: "Heading 2",
          run: getRunProps(settings.heading2),
          paragraph: getStyleProps(settings.heading2),
        },
        {
          id: "Heading3",
          name: "Heading 3",
          run: getRunProps(settings.heading3),
          paragraph: getStyleProps(settings.heading3),
        },
        {
          id: "Heading4",
          name: "Heading 4",
          run: getRunProps(settings.heading4),
          paragraph: getStyleProps(settings.heading4),
        },
        {
          id: "Heading5",
          name: "Heading 5",
          run: getRunProps(settings.heading5),
          paragraph: getStyleProps(settings.heading5),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwips(25.4),
              bottom: convertMillimetersToTwips(25.4),
              left: convertMillimetersToTwips(25.4),
              right: convertMillimetersToTwips(25.4),
            },
          },
        },
        children: [
          // Header / Title
          new Paragraph({
            text: "PROJETO DE ACÓRDÃO",
            heading: HeadingLevel.HEADING_1,
          }),

          // I - Relatório
          new Paragraph({
            text: "I - RELATÓRIO",
            heading: HeadingLevel.HEADING_2,
          }),
          ...parseContent(data.report),
          
          // Decision of First Instance moved to end of Report
          new Paragraph({
            text: "Foi proferida sentença que",
            style: "Normal",
          }),
          ...parseContent(data.decisionFirstInstance, "Normal", true),

          // Insert Appeals Conclusions
          new Paragraph({
            text: "As conclusões das alegações de recurso são as seguintes:",
            style: "Citation",
          }),

          ...data.appealConclusions.flatMap(ac => {
            const paragraphs: (Paragraph | Table)[] = [];
            
            // If it's a new Appeal (Recurso), add a numbered heading
            if (ac.type === 'RECURSO') {
              resourceCounter++;
              paragraphs.push(
                new Paragraph({
                  text: `Recurso ${resourceCounter}`,
                  heading: HeadingLevel.HEADING_3,
                })
              );
            }

            // Source identification
            paragraphs.push(
              new Paragraph({
                children: [
                    new TextRun({ text: ac.source, bold: true })
                ],
                style: "Citation",
              })
            );

            // Content paragraphs (with support for tables in conclusions if any)
            paragraphs.push(...parseContent(ac.content, "Citation"));

            return paragraphs;
          }),

          // Empty line before next chapter
          new Paragraph({ text: "", style: "Normal" }),

          // II – Objeto do recurso
          new Paragraph({
            text: "II – OBJETO DO RECURSO",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: "O objeto do recurso é delimitado pelas conclusões da alegação apresentada, não podendo este Tribunal conhecer de matérias nelas não incluídas, sem prejuízo das questões de conhecimento oficioso, que não tenham sido apreciadas com trânsito em julgado e das que se não encontrem prejudicadas pela solução dada a outras [artigos 635.º, n.º 4, 637.º n.º 2, 1ª parte, 639.º, n.ºs 1 e 2, 608.º, n.º 2, do Código de Processo Civil, aplicáveis por força do artigo 87.º, n.º 1, do Código de Processo do Trabalho].",
            style: "Normal",
          }),
          new Paragraph({
            text: "Assim, e tendo em conta as conclusões apresentadas, são as seguintes as questões colocadas no recurso:",
            style: "Normal",
          }),
          ...parseContent(data.appealQuestions),

          new Paragraph({
            children: [new TextRun({ text: "Factos impugnados:", bold: true })],
            style: "Normal",
          }),
          ...parseContent(data.impugnedFacts || "Não foi identificada impugnação da matéria de facto."),

          // Empty line before next chapter
          new Paragraph({ text: "", style: "Normal" }),

          // III - Fundamentação
          new Paragraph({
            text: "III - FUNDAMENTAÇÃO DE FACTO",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: "FACTOS PROVADOS",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: "A 1ª instância considerou provados os seguintes factos:",
            style: "Citation",
          }),
          ...parseContent(data.provenFacts, "Citation"),

          new Paragraph({
            text: "FACTOS NÃO PROVADOS",
            heading: HeadingLevel.HEADING_2,
          }),
           ...parseContent(data.unprovenFacts || "Nada a consignar.", "Citation"),

          // Empty line before next chapter
          new Paragraph({ text: "", style: "Normal" }),

          // IV - Direito (Placeholder)
          new Paragraph({
            text: "IV - FUNDAMENTAÇÃO DE DIREITO",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
             children: [new TextRun({ text: "[Inserir fundamentação jurídica aqui]", italics: true, color: "808080" })],
             style: "Normal",
          }),

          // Empty line before next chapter
          new Paragraph({ text: "", style: "Normal" }),

          // V - Decisão
          new Paragraph({
            text: "V - DECISÃO",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [new TextRun({ text: "Pelo exposto, acordam os juízes desta secção em...", italics: true })],
            style: "Normal",
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const saveAs = (FileSaver as any).saveAs || FileSaver;
  saveAs(blob, "Projeto_Acordao.docx");
};