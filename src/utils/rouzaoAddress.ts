import { CHINA_PROVINCES } from '../const/geo'
import type { ShopifyOrderExportItem } from '../types'

function normalizeCity(cityName: string) {
  const parts = cityName.split('市')

  if (parts.length > 1 && parts[1] !== '') {
    return cityName
  }

  return parts[0] + '市' + (parts[1] || '')
}

export function rouzaoAddress(row: ShopifyOrderExportItem) {
  const prov = CHINA_PROVINCES[row['Shipping Province'] || ''] || ''
  const city = normalizeCity(row['Shipping City'] || '')
  const street = row['Shipping Street'] || ''

  return `${prov}${city}${street}`
}
