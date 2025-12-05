import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LineRuleType, Table, TableRow, TableCell, BorderStyle, WidthType, TableLayoutType } from "docx";
// @ts-ignore
import FileSaver from "file-saver";
import { CaseData } from "../types";

// Helper function to convert millimeters to twips (1/20th of a point)
// 1 inch = 25.4 mm = 1440 twips
const convertMillimetersToTwips = (millimeters: number): number => {
    return Math.round((millimeters / 25.4) * 1440);
};

// HELPER: Parses text content, handling markdown tables, lists, and fixing broken sentences
const parseContent = (text: string): (Paragraph | Table)[] => {
    if (!text) return [new Paragraph({ text: "", style: "Normal" })];
    
    const children: (Paragraph | Table)[] = [];
    // Split by newlines
    const lines = text.split(/\r?\n/);
    
    let tableBuffer: string[] = [];
    let textBuffer: string[] = []; 

    const flushTable = () => {
        if (tableBuffer.length > 0) {
            flushText(); // Ensure text before table is written
            children.push(createTableFromMarkdown(tableBuffer));
            tableBuffer = [];
        }
    };

    const flushText = () => {
        if (textBuffer.length > 0) {
            // Join lines with space to "heal" broken sentences
            const paragraphText = textBuffer.join(" ");
            children.push(new Paragraph({
                text: paragraphText.trim(),
                style: "Normal",
            }));
            textBuffer = [];
        }
    };

    const isTableLine = (line: string) => {
        const trimmed = line.trim();
        // Strict check: must start and end with pipe
        return trimmed.startsWith('|') && trimmed.endsWith('|');
    };

    // Regex to detect list items (e.g., "1.", "1)", "a)", "-", "*")
    // This prevents merging a list item into the previous paragraph
    const isListItem = (line: string) => {
        const trimmed = line.trim();
        return /^[0-9]+[\.\)]\s/.test(trimmed) || 
               /^[a-zA-Z][\.\)]\s/.test(trimmed) || 
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
const createTableFromMarkdown = (rows: string[]): Table => {
    // Filter out separator rows (e.g., |---|---|)
    const dataRows = rows.filter(row => !row.match(/^\|\s*:?-+:?\s*\|/));
    
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
                        // Calibri Light, 9pt (18 half-points), Justified
                        // Indent: 0 (Interior/Exterior/Special None)
                        // Spacing: Before/After 0, Single line spacing
                        run: {
                            font: "Calibri Light",
                            size: 18, // 9pt
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

export const generateDocx = async (data: CaseData) => {
  let resourceCounter = 0;

  // Configuration constants
  const FONT_FACE = "Calibri Light";
  const LINE_SPACING = 360; // 240 = single, 360 = 1.5 lines
  const INDENT_FIRST_LINE = convertMillimetersToTwips(10); // 1 cm
  
  // Common paragraph properties (Justified, Indent 1cm, Spacing 0, Line 1.5)
  const commonParagraphProps = {
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: INDENT_FIRST_LINE },
    spacing: { before: 0, after: 0, line: LINE_SPACING, lineRule: LineRuleType.AUTO },
  };

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FACE,
            size: 24, // 12pt (docx uses half-points)
          },
          paragraph: commonParagraphProps,
        },
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: {
            font: FONT_FACE,
            size: 24, // 12pt
          },
          paragraph: commonParagraphProps,
        },
        {
          id: "Heading1",
          name: "Heading 1",
          run: {
            font: FONT_FACE,
            size: 28, // 14pt
            bold: true,
            color: "000000", // Force black
          },
          paragraph: commonParagraphProps,
        },
        {
          id: "Heading2",
          name: "Heading 2",
          run: {
            font: FONT_FACE,
            size: 26, // 13pt
            bold: true,
            color: "000000",
          },
          paragraph: commonParagraphProps,
        },
        {
          id: "Heading3",
          name: "Heading 3",
          run: {
            font: FONT_FACE,
            size: 24, // 12pt
            bold: true,
            color: "000000",
          },
          paragraph: commonParagraphProps,
        },
        // Mapped for H4, H5, H6 as requested (same style as H3)
        {
          id: "Heading4",
          name: "Heading 4",
          run: { font: FONT_FACE, size: 24, bold: true, color: "000000" },
          paragraph: commonParagraphProps,
        },
        {
          id: "Heading5",
          name: "Heading 5",
          run: { font: FONT_FACE, size: 24, bold: true, color: "000000" },
          paragraph: commonParagraphProps,
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: [
          // Header / Title
          new Paragraph({
            text: "PROJETO DE ACÓRDÃO",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER, // Override center just for main title
            indent: { firstLine: 0 }, // No indent for main title
            spacing: { after: 400, line: LINE_SPACING },
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
            spacing: { before: 240, after: 0, line: LINE_SPACING },
          }),
          ...parseContent(data.decisionFirstInstance),

          // Insert Appeals Conclusions
          new Paragraph({
            text: "As conclusões das alegações de recurso são as seguintes:",
            style: "Normal",
            spacing: { before: 240, after: 0, line: LINE_SPACING },
            // Keep manual italics override if desired, but base is Normal
            children: [new TextRun({ text: "As conclusões das alegações de recurso são as seguintes:", italics: true })],
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
                style: "Normal",
              })
            );

            // Content paragraphs (with support for tables in conclusions if any)
            paragraphs.push(...parseContent(ac.content));

            return paragraphs;
          }),

          // II - Fundamentação
          new Paragraph({
            text: "II - FUNDAMENTAÇÃO DE FACTO",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 0, line: LINE_SPACING }, // Slight visual separator before H2 if needed, or keep 0
          }),
          new Paragraph({
            text: "A 1ª instância considerou provados os seguintes factos:",
            style: "Normal",
          }),
          ...parseContent(data.provenFacts),

          new Paragraph({
            children: [new TextRun({ text: "Factos não provados:", bold: true })],
            style: "Normal",
            spacing: { before: 240, after: 0, line: LINE_SPACING }, 
          }),
           ...parseContent(data.unprovenFacts || "Nada a consignar."),

          // III - Direito (Placeholder)
          new Paragraph({
            text: "III - FUNDAMENTAÇÃO DE DIREITO",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 0, line: LINE_SPACING },
          }),
          new Paragraph({
             children: [new TextRun({ text: "[Inserir fundamentação jurídica aqui]", italics: true, color: "808080" })],
             style: "Normal",
          }),

          // IV - Decisão
          new Paragraph({
            text: "IV - DECISÃO",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 0, line: LINE_SPACING },
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