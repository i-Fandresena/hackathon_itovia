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

/** Date et heure — pour un fil d'activité où plusieurs événements tombent le même jour. */
export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
