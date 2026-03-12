export const COMMON_FONTS = [
  "Arial",
  "Calibri",
  "Cambria",
  "Constantia",
  "Courier New",
  "Georgia",
  "Helvetica",
  "Liberation Sans",
  "Liberation Serif",
  "Palatino Linotype",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana"
];

export const DEFAULT_STYLE: any = {
  font: "Times New Roman",
  size: 12,
  bold: false,
  italics: false,
  alignment: "JUSTIFIED",
  indentLeft: 0,
  indentRight: 0,
  indentFirstLine: 12.5,
  spacingBefore: 0,
  spacingAfter: 6,
  lineSpacing: 360, // 1.5
};

export const DEFAULT_TEMPLATE: any = {
  name: "Modelo Padrão",
  normal: { ...DEFAULT_STYLE },
  heading1: { ...DEFAULT_STYLE, size: 16, bold: true, spacingBefore: 12, spacingAfter: 12, indentFirstLine: 0 },
  heading2: { ...DEFAULT_STYLE, size: 14, bold: true, spacingBefore: 12, spacingAfter: 6, indentFirstLine: 0 },
  heading3: { ...DEFAULT_STYLE, size: 12, bold: true, spacingBefore: 12, spacingAfter: 6, indentFirstLine: 0 },
  heading4: { ...DEFAULT_STYLE, size: 12, bold: true, italics: true, spacingBefore: 6, spacingAfter: 6, indentFirstLine: 0 },
  heading5: { ...DEFAULT_STYLE, size: 12, italics: true, spacingBefore: 6, spacingAfter: 6, indentFirstLine: 0 },
  citation: { ...DEFAULT_STYLE, size: 11, indentLeft: 40, indentFirstLine: 0, spacingBefore: 6, spacingAfter: 6 },
};
