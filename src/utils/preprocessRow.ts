import type { ShopifyOrderExportItem } from '../types'

/**
 * Fill Shopify export with missing field for order with multiple items
 * @param data
 * @returns ShopifyOrderExportItem[]
 */
export function preprocessRow(data: ShopifyOrderExportItem[]) {
  const orderMap: { [order: string]: ShopifyOrderExportItem } = {}
  const enrichedData: ShopifyOrderExportItem[] = []

  for (const row of data) {
    const orderId = row['Name']

    // Store order ID with full details
    if (!orderMap[orderId]) {
      orderMap[orderId] = { ...row }
    }

    // Extract SKUs
    const skus = row['Lineitem sku'].split(',')

    for (const sku of skus) {
      // Create a new row for each SKU with details
      const newRow = { ...orderMap[orderId], 'Lineitem sku': sku }

      // Fill the missing fields
      newRow['Shipping Name'] = newRow['Shipping Name'] || orderMap[orderId]['Shipping Name']
      newRow['Shipping Phone'] = newRow['Shipping Phone'] || orderMap[orderId]['Shipping Phone']
      newRow['Shipping Province'] =
        newRow['Shipping Province'] || orderMap[orderId]['Shipping Province']
      newRow['Shipping City'] = newRow['Shipping City'] || orderMap[orderId]['Shipping City']
      newRow['Shipping Street'] = newRow['Shipping Street'] || orderMap[orderId]['Shipping Street']

      enrichedData.push(newRow)
    }
  }

  return enrichedData
}
