export function rouzaoPhone(phone: string | number) {
  if (typeof phone === 'string') {
    return phone.replaceAll('+86', '').replaceAll(' ', '')
  } else {
    if (phone.toString().startsWith('86')) {
      return phone.toString().replace('86', '')
    } else {
      return phone
    }
  }
}
