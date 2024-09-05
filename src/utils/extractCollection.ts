export function extractCollection(sku: string): string {
  const match = sku.match(/__COLLE:(.+)$/)
  return match ? match[1] : 'default'
}
