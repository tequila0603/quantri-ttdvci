import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { AggregateReportModel, ReportTable } from './model.js'

const FONT = 'Times New Roman'
const normal = { font: FONT, size: 26 }
type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType]
const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
}

function text(value: string, bold = false): TextRun {
  return new TextRun({ text: value, bold, ...normal })
}

function paragraph(value: string, options: { bold?: boolean; center?: boolean; right?: boolean; indent?: boolean; keepNext?: boolean; before?: number; after?: number } = {}): Paragraph {
  return new Paragraph({
    children: [text(value, options.bold)],
    alignment: options.center ? AlignmentType.CENTER : options.right ? AlignmentType.RIGHT : AlignmentType.JUSTIFIED,
    ...(options.indent ? { indent: { firstLine: 720 } } : {}),
    ...(options.keepNext ? { keepNext: true } : {}),
    spacing: { before: options.before ?? 0, after: options.after ?? 100, line: 300 },
  })
}

function reportTable(table: ReportTable): Array<Paragraph | Table> {
  const cell = (value: string, alignment: AlignmentValue = AlignmentType.LEFT, bold = false) => new TableCell({
    margins: { top: 70, bottom: 70, left: 80, right: 80 },
    children: [new Paragraph({ children: [text(value, bold)], alignment })],
  })
  const align = (value?: 'left' | 'center' | 'right') => value === 'right' ? AlignmentType.RIGHT : value === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT
  const rows = [
    new TableRow({ tableHeader: true, children: table.columns.map((column) => cell(column.label, AlignmentType.CENTER, true)) }),
    ...table.rows.map((row) => new TableRow({ children: table.columns.map((column) => cell(row[column.key] ?? 'Chưa có dữ liệu', align(column.align))) })),
    ...(table.totalRow ? [new TableRow({ children: table.columns.map((column) => cell(table.totalRow?.[column.key] ?? '', align(column.align), true)) })] : []),
  ]
  return [
    paragraph(table.title, { bold: true, before: 120, keepNext: true }),
    paragraph(`Đơn vị tính: ${table.unit}`, { right: true, keepNext: true }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows }),
    paragraph('', { after: 60 }),
  ]
}

function overviewTable(metrics: AggregateReportModel['overview']): Table {
  const cell = (value: string, alignment: AlignmentValue = AlignmentType.LEFT, bold = false) => new TableCell({
    margins: { top: 70, bottom: 70, left: 80, right: 80 },
    children: [new Paragraph({ children: [text(value, bold)], alignment })],
  })
  const rows = [
    new TableRow({ tableHeader: true, children: [cell('STT', AlignmentType.CENTER, true), cell('Chỉ tiêu', AlignmentType.CENTER, true), cell('Đơn vị tính', AlignmentType.CENTER, true), cell('Giá trị', AlignmentType.CENTER, true)] }),
    ...metrics.map((item, index) => new TableRow({ children: [
      cell(String(index + 1), AlignmentType.CENTER),
      cell(item.label),
      cell(item.unit, AlignmentType.CENTER),
      cell(item.value, AlignmentType.RIGHT),
    ] })),
  ]
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows })
}

export async function createAggregateReportDocx(model: AggregateReportModel): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [
    paragraph('BÁO CÁO', { bold: true, center: true, after: 40 }),
    paragraph(`Tình hình hoạt động trong ${model.scope.periodLabel} tại ${model.scope.parkName}`, { bold: true, center: true, after: 60 }),
  ]

  const overviewSection = model.sections.find((section) => section.id === 'overview')
  if (model.overview.length || overviewSection) {
    children.push(...(overviewSection?.paragraphs.map((value) => paragraph(value, { indent: true })) ?? []))
    if (model.overview.length) children.push(overviewTable(model.overview))
  }

  const domainSections = model.sections.filter((item) => item.id !== 'overview')
  for (const section of domainSections) {
    children.push(...section.paragraphs.map((value) => paragraph(value, { indent: true })))
    for (const table of section.tables) children.push(...reportTable(table))
  }

  children.push(...(model.findings.length ? model.findings.flatMap((item, index) => [paragraph(`${index + 1}. ${item.title}`, { bold: true }), paragraph(item.evidence, { indent: true }), paragraph(`Nguyên nhân: ${item.cause}`, { indent: true })]) : [paragraph('Tại thời điểm chốt dữ liệu không ghi nhận tồn tại thuộc các tiêu chí thống kê của báo cáo.', { indent: true })]))
  children.push(...(model.recommendations.length ? model.recommendations.map((item, index) => paragraph(`${index + 1}. ${item.text}`)) : [paragraph('Không phát sinh đề xuất từ các tiêu chí thống kê của báo cáo.')]))

  const document = new Document({
    creator: "System",
    title: "Report",
    description: "",
    styles: { default: { document: { run: normal, paragraph: { spacing: { line: 300 } } } } },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 850, header: 420 } },
        titlePage: true,
      },
      headers: {
        first: new Header({ children: [new Paragraph('')] }),
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], ...normal })] })] }),
      },
      children,
    }],
  })
  return Packer.toBuffer(document)
}
