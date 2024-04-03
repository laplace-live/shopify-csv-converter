import type { ShopifyOrderExportItem } from '../types/main'

/**
 * Fill Shopify export with missing field for order with multiple items
 * @param data
 * @returns
 */
export function preprocessRow(data: ShopifyOrderExportItem[]) {
  const orderMap: {
    [order: string]: {
      name: string
      phone: number
      province: string
      city: string
      street: string
    }
  } = {}

  for (const row of data) {
    const orderId = row['Name']

    if (!orderMap[orderId]) {
      orderMap[orderId] = {
        name: row['Shipping Name'] || '',
        phone: row['Shipping Phone'] || 0,
        province: row['Shipping Province'] || '',
        city: row['Shipping City'] || '',
        street: row['Shipping Street'] || '',
      }
    } else {
      row['Shipping Name'] = row['Shipping Name'] || orderMap[orderId].name
      row['Shipping Phone'] = row['Shipping Phone'] || orderMap[orderId].phone
      row['Shipping Province'] = row['Shipping Province'] || orderMap[orderId].province
      row['Shipping City'] = row['Shipping City'] || orderMap[orderId].city
      row['Shipping Street'] = row['Shipping Street'] || orderMap[orderId].street
    }
  }

  return data
}
