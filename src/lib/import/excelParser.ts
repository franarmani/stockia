/**
 * excelParser.ts
 * Parses .xlsx / .xls / .csv files using SheetJS + PapaParse.
 * Returns sheet names, headers, and raw rows.
 */

import * as XLSX from 'xlsx'
import type { ColumnMapping } from './columnMatcher'
import { detectColumns } from './columnMatcher'

export interface ParsedFile {
  sheetNames: string[]
  selectedSheet: string
  headers: string[]
  rows: Record<string, unknown>[]
  columnMappings: ColumnMapping[]
}

export interface ParseOptions {
  sheetName?: string
  /** If true, treat first row as data (no headers). NOT recommended */
  noHeaders?: boolean
}

function isLikelyCsv(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
}

/** Read file → workbook via SheetJS */
async function fileToWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array', cellDates: true, raw: false })
        resolve(wb)
      } catch (err) {
        reject(new Error('No se pudo leer el archivo. Asegurate de que sea .xlsx, .xls o .csv válido.'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo.'))
    if (isLikelyCsv(file)) {
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}

function csvToWorkbook(text: string): XLSX.WorkBook {
  const wb = XLSX.read(text, { type: 'string' })
  return wb
}

export async function parseFile(file: File, options: ParseOptions = {}): Promise<ParsedFile> {
  let workbook: XLSX.WorkBook

  if (isLikelyCsv(file)) {
    const text = await file.text()
    workbook = csvToWorkbook(text)
  } else {
    workbook = await fileToWorkbook(file)
  }

  const sheetNames = workbook.SheetNames
  const selectedSheet = options.sheetName || sheetNames[0]
  const worksheet = workbook.Sheets[selectedSheet]

  if (!worksheet) throw new Error(`Hoja "${selectedSheet}" no encontrada.`)

  // Get raw data as array of arrays
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    dateNF: 'dd/mm/yyyy',
  }) as unknown[][]

  if (rawData.length === 0) throw new Error('El archivo está vacío.')

  // Detect headers: first row
  const headerRow = (rawData[0] as unknown[]).map((cell) => String(cell ?? '').trim())
  const dataRows = rawData.slice(1)

  // Filter out completely empty rows
  const nonEmptyRows = dataRows.filter((row) =>
    (row as unknown[]).some((cell) => cell !== '' && cell !== null && cell !== undefined)
  )

  // Build row objects
  const rows: Record<string, unknown>[] = nonEmptyRows.map((row) => {
    const obj: Record<string, unknown> = {}
    headerRow.forEach((h, i) => {
      obj[h] = (row as unknown[])[i] ?? ''
    })
    return obj
  })

  const columnMappings = detectColumns(headerRow)

  return { sheetNames, selectedSheet, headers: headerRow, rows, columnMappings }
}

/** Generate a template .xlsx file with recommended columns */
export function generateTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new()
  const headers = ['nombre', 'precio_venta', 'precio_compra', 'stock', 'stock_min', 'codigo_barras', 'categoria', 'unidad', 'marca', 'descripcion']
  const example1 = ['Producto Ejemplo A', 1500, 900, 10, 2, '7790123456789', 'General', 'u', 'MarcaX', 'Descripción opcional']
  const example2 = ['Producto Ejemplo B', 2200, 1400, 5, 1, '', 'Electrónica', 'u', '', '']
  const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2])
  // Column widths
  ws['!cols'] = headers.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}
