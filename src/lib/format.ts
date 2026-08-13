export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function formatMonth(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function formatAriary(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} Ar`
}
