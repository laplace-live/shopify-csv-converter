import { parseArgs } from 'util'
import { consola } from 'consola'

// https://docs.sheetjs.com/docs/getting-started/installation/bun/
import * as XLSX from 'xlsx'

/* load 'fs' for readFile and writeFile support */
import * as fs from 'fs'
XLSX.set_fs(fs)

/* load 'stream' for stream support */
import { Readable } from 'stream'

import type { ShopifyOrderExportItem } from './types'

import { preprocessRow } from './utils/preprocessRow'
import { processAddr } from './utils/processAddr'
import { extractCollection } from './utils/extractCollection'

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

// Filter out rows without SKU
const resolvedJson = json.filter((row) => row['Lineitem sku'])
consola.start(`Got ${resolvedJson.length} item${resolvedJson.length > 1 && 's'}`)

const processedJson = preprocessRow(resolvedJson)

const providersString = process.env.PROVIDERS || ''
const providers = providersString.split(',')
const orderPrefix = process.env.ORDER_PREFIX || 'SHOPIFY'

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
      const isGuanyi = row['Lineitem sku'] && row['Lineitem sku'].startsWith('SUBSPACE_WH1_')
      const orderId = args.orderId ? args.orderId : `${orderPrefix}${row['Name']}`
      const addObj = processAddr(row)
      const collection = extractCollection(row['Lineitem sku'])
      const resolvedSku = row['Lineitem sku'].replace(/__COLLE:.+$/, '')

      if (isRouzao) {
        return {
          第三方订单号: orderId,
          收件人: row['Shipping Name'],
          联系电话: addObj.rouzaoPhone,
          收件地址: addObj.rouzaoAddr,
          商家编码: resolvedSku,
          下单数量: row['Lineitem quantity'],
          _collection: collection,
        }
      }

      if (isGuanyi) {
        return {
          店铺: orderPrefix,
          平台单号: orderId,
          买家会员: row['Email'],
          支付金额: row['Total'],
          商品名称: row['Lineitem name'],
          商品代码: resolvedSku.replace(provider, ''),
          数量: row['Lineitem quantity'],
          价格: row['Lineitem price'],
          收货人: row['Shipping Name'],
          联系电话: addObj.rouzaoPhone,
          收货地址: addObj.rouzaoAddr,
          省: addObj.prov,
          市: addObj.city,
          _collection: collection,
        }
      }

      // General provider
      return {
        '订单ID': orderId,
        '商品编号': `${orderId}-${idx + 1}`,
        '产品信息': row['Lineitem name'],
        '数量': row['Lineitem quantity'],
        'SKU': resolvedSku.replace(provider, ''),
        '姓名': row['Shipping Name'],
        '州/省': addObj.prov,
        '城市': addObj.city,
        '地址1': addObj.street,
        '邮编': addObj.zip,
        '电话2': addObj.phone,
        '收货国家': addObj.country,
        '_collection': collection,
      }
    })

  // Group data by collection
  const groupedData = filteredData.reduce(
    (acc, item) => {
      const collection = item._collection
      if (!acc[collection]) {
        acc[collection] = []
      }
      acc[collection].push(item)
      return acc
    },
    {} as Record<string, typeof filteredData>
  )

  // Generate Excel files for each collection
  Object.entries(groupedData).forEach(([collection, data]) => {
    const providerStr = provider.toLowerCase().replace(/_$/g, '')

    if (data.length > 0) {
      const outputFilename = `${collection}_${providerStr}_${new Date().toISOString().slice(0, 10)}.xlsx`
      const fullPath = args.outputDir ? `${args.outputDir}/${outputFilename}` : outputFilename
      const newWb = XLSX.utils.book_new()
      const newWorksheet = XLSX.utils.json_to_sheet(
        data.map((item) => {
          // Remove internal collection field
          const { _collection, ...rest } = item
          return rest
        })
      )
      XLSX.utils.book_append_sheet(newWb, newWorksheet, `Filtered Data`)
      XLSX.writeFile(newWb, fullPath)
      consola.success(`[${collection}] ${providerStr}: ${data.length} items`)
    } else {
      consola.info(`No items found for ${providerStr} in collection: ${collection}`)
    }
  })
})
