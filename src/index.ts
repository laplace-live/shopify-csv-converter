import { parseArgs } from 'util'
import { consola } from 'consola'

import type { ShopifyOrderExportItem } from './types'

import { preprocessRow } from './utils/preprocessRow'

// https://docs.sheetjs.com/docs/getting-started/installation/bun/
import * as XLSX from 'xlsx'

/* load 'fs' for readFile and writeFile support */
import * as fs from 'fs'
XLSX.set_fs(fs)

/* load 'stream' for stream support */
import { Readable } from 'stream'
import { processAddr } from './utils/processAddr'

XLSX.stream.set_readable(Readable)

/* load the codepage support library for extended support with older formats  */
// import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs'
// XLSX.set_cptable(cpexcel)

// https://bun.sh/guides/process/argv
const { values: args, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    input: { type: 'string' },
    outputDir: { type: 'string' },
    orderId: { type: 'boolean' },
  },
  strict: true,
  allowPositionals: true,
})

if (!args.input) {
  throw new Error('Missing input file')
}

const filePath = args.input
const data = await Bun.file(filePath).text()

const wb = XLSX.read(data, { type: 'string' })

// Get the first sheet name and the worksheet
const worksheet = wb.Sheets[wb.SheetNames[0]]

// Convert to JSON
const json = XLSX.utils.sheet_to_json<ShopifyOrderExportItem>(worksheet)
consola.start(`Got ${json.length} item${json.length > 1 && 's'}`)

const processedJson = preprocessRow(json)

const providersString = process.env.PROVIDERS || ''
const providers = providersString.split(',')

providers.forEach((provider) => {
  const filteredData = processedJson
    // Filter out the necessary columns
    .filter((row) => {
      // sku can be empty
      return row['Lineitem sku'] && row['Lineitem sku'].startsWith(provider) && !row['Cancelled at']
    })
    // Map keys
    .map((row, idx) => {
      const isRouzao = row['Lineitem sku'] && row['Lineitem sku'].startsWith('ROUZAO_')
      const orderId = args.orderId ? args.orderId : `SHOPIFY${row['Name']}`
      const addObj = processAddr(row)

      if (isRouzao) {
        return {
          第三方订单号: orderId,
          收件人: row['Shipping Name'],
          联系电话: addObj.rouzaoPhone,
          收件地址: addObj.rouzaoAddr,
          商家编码: row['Lineitem sku'],
          下单数量: row['Lineitem quantity'],
        }
      } else {
        return {
          '订单ID': orderId,
          '商品编号': `${orderId}-${idx + 1}`,
          '产品信息': row['Lineitem name'],
          '数量': row['Lineitem quantity'],
          'SKU': row['Lineitem sku'].replace(provider, ''),
          '姓名': row['Shipping Name'],
          '州/省': addObj.prov,
          '城市': addObj.city,
          '地址1': addObj.street,
          '邮编': addObj.zip,
          '电话2': addObj.phone,
          '收货国家': addObj.country,
        }
      }
    })

  if (filteredData.length > 0) {
    const outputFilename = `output_${provider.toLowerCase()}${new Date().toISOString().slice(0, 10)}.xlsx`
    const fullPath = args.outputDir ? `${args.outputDir}/${outputFilename}` : outputFilename
    const newWb = XLSX.utils.book_new()
    const newWorksheet = XLSX.utils.json_to_sheet(filteredData)
    XLSX.utils.book_append_sheet(newWb, newWorksheet, `Filtered Data`)
    XLSX.writeFile(newWb, fullPath)
    consola.success(`Generated ${fullPath} with ${filteredData.length} items`)
  } else {
    consola.info(`No items found for ${provider}`)
  }
})
