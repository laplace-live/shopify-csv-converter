import { parseArgs } from 'util'
import type { ShopifyOrderExportItem } from './types/main'

// https://docs.sheetjs.com/docs/getting-started/installation/bun/
import * as XLSX from 'xlsx'

// https://bun.sh/guides/process/argv
const { values: args, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    input: {
      type: 'string',
    },
    output: {
      type: 'string',
    },
  },
  strict: true,
  allowPositionals: true,
})

if (!args.input) {
  throw new Error('Missing input file')
}

const outputFilename = args.output || 'output.xlsx'

/* load 'fs' for readFile and writeFile support */
import * as fs from 'fs'
XLSX.set_fs(fs)

/* load 'stream' for stream support */
import { Readable } from 'stream'
import { preprocessRow } from './utils/preprocessRow'
import { rouzaoAddress } from './utils/rouzaoAddress'
XLSX.stream.set_readable(Readable)

/* load the codepage support library for extended support with older formats  */
// import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs'
// XLSX.set_cptable(cpexcel)

const filePath = args.input
const data = await Bun.file(filePath).text()

const wb = XLSX.read(data, {
  type: 'string',
})

// Get the first sheet name and the worksheet
const worksheet = wb.Sheets[wb.SheetNames[0]]

// Convert to JSON
const json = XLSX.utils.sheet_to_json<ShopifyOrderExportItem>(worksheet)
console.log(`Got ${json.length} item${json.length > 1 && 's'}`)

const processedJson = preprocessRow(json)

const filteredData = processedJson
  // Filter out the necessary columns
  .filter((row) => {
    // sku can be empty
    return row['Lineitem sku'] && row['Lineitem sku'].startsWith('ROUZAO_')
  })
  // Map keys
  .map((row) => ({
    第三方订单号: `SHOPIFY:${row['Name'].replace('#', '')}`,
    收件人: row['Shipping Name'],
    联系电话: row['Shipping Phone'],
    收件地址: rouzaoAddress(row),
    商家编码: row['Lineitem sku'],
    下单数量: row['Lineitem quantity'],
  }))

console.log(`Found ${filteredData.length} valid item${filteredData.length > 1 && 's'}`)

// Extract the desired column (e.g., 'address')
const newWb = XLSX.utils.book_new()
const newWorksheet = XLSX.utils.json_to_sheet(filteredData)
XLSX.utils.book_append_sheet(newWb, newWorksheet, 'Filtered Data')

XLSX.writeFile(newWb, outputFilename)
console.log(`Generated sheet: ${outputFilename}`)