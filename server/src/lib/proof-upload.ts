import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Preuve jointe à une recommandation. Talent : une photo du travail réalisé
 * (JPEG, PNG, WebP). Entreprise : une photo OU un PDF (contrat, bulletin de
 * paie…), revu par un admin puis supprimé du disque. Jamais publique — servie
 * par `uploads.routes.ts` aux seuls agents habilités (talents), admins et à
 * l'auteur.
 *
 * Chaîne : multer en mémoire (5 Mo) -> contrôle des octets magiques (le type
 * annoncé par le navigateur ne suffit pas) -> retrait des segments APP1
 * (EXIF/XMP : position GPS, appareil) des JPEG -> écriture sous
 * `uploads/preuves/<uuid>.<ext>`, à côté de `uploads/cv/`.
 */

export const PROOF_MAX_BYTES = 5 * 1024 * 1024
export const PROOF_DIR = path.resolve(process.cwd(), 'uploads', 'preuves')
/** Noms générés ici uniquement : aucun chemin arbitraire ne peut être servi. */
export const PROOF_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$/

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const DOCUMENT_MIME = new Set([...IMAGE_MIME, 'application/pdf'])

const PHOTO_ONLY_MESSAGE = 'La preuve doit être une photo (JPEG, PNG ou WebP).'
const PHOTO_OR_PDF_MESSAGE = 'La preuve doit être une photo (JPEG, PNG, WebP) ou un PDF.'

function makeUpload(allowed: Set<string>, message: string) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: PROOF_MAX_BYTES, files: 1, fields: 5 },
    fileFilter: (_req, file, cb) => {
      if (allowed.has(file.mimetype)) cb(null, true)
      else cb(new ProofFileError(message))
    },
  })
}

const photoUpload = makeUpload(IMAGE_MIME, PHOTO_ONLY_MESSAGE)
const documentUpload = makeUpload(DOCUMENT_MIME, PHOTO_OR_PDF_MESSAGE)

export class ProofFileError extends Error {}

/** Talent — `multipart/form-data` : champ `payload` (JSON) + photo `proof` facultative. Erreurs -> 400 en français. */
export function parseProofUpload(req: Request, res: Response, next: NextFunction): void {
  handleUpload(photoUpload, req, res, next)
}

/** Entreprise — même format, la preuve peut aussi être un PDF (contrat, bulletin). */
export function parseCompanyProofUpload(req: Request, res: Response, next: NextFunction): void {
  handleUpload(documentUpload, req, res, next)
}

function handleUpload(upload: multer.Multer, req: Request, res: Response, next: NextFunction): void {
  upload.single('proof')(req, res, (err: unknown) => {
    if (!err) return next()
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Le fichier dépasse 5 Mo.'
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Un seul fichier est accepté (champ « proof »).'
            : 'Envoi du formulaire invalide.'
      res.status(400).json({ error: message })
      return
    }
    if (err instanceof ProofFileError) {
      res.status(400).json({ error: err.message })
      return
    }
    next(err)
  })
}

type ImageKind = 'jpg' | 'png' | 'webp'
type ProofKind = ImageKind | 'pdf'

/** PDF d'après les premiers octets (`%PDF-`). */
export function isPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-'
}

/** Type réel d'après les premiers octets, `null` si ce n'est pas une image acceptée. */
export function detectImageKind(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png'
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp'
  }
  return null
}

/**
 * Retire les segments APP1 (EXIF, XMP) d'un JPEG. Parcourt les marqueurs
 * jusqu'au début des données d'image (SOS), recopie le reste tel quel.
 * Lève si la structure est incohérente.
 */
export function stripJpegApp1(buf: Buffer): Buffer {
  const parts: Buffer[] = [buf.subarray(0, 2)]
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new ProofFileError('Photo JPEG illisible.')
    const marker = buf[i + 1]
    // Octets de remplissage 0xFF entre marqueurs.
    if (marker === 0xff) {
      i++
      continue
    }
    // Marqueurs sans longueur (RSTn, TEM).
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      parts.push(buf.subarray(i, i + 2))
      i += 2
      continue
    }
    if (marker === 0xd9) {
      parts.push(buf.subarray(i))
      break
    }
    if (i + 4 > buf.length) throw new ProofFileError('Photo JPEG illisible.')
    const length = buf.readUInt16BE(i + 2)
    const end = i + 2 + length
    if (length < 2 || end > buf.length) throw new ProofFileError('Photo JPEG illisible.')
    if (marker === 0xda) {
      // Début des données compressées : tout le reste est recopié.
      parts.push(buf.subarray(i))
      break
    }
    if (marker !== 0xe1) parts.push(buf.subarray(i, end))
    i = end
  }
  return Buffer.concat(parts)
}

/**
 * Valide et écrit la preuve. Renvoie l'URL servie (`/uploads/preuves/…`) et
 * le chemin disque (pour l'effacer si l'enregistrement en base échoue).
 * `allowPdf` (entreprises seulement) : un PDF est accepté s'il en a les
 * octets magiques ; ses métadonnées ne sont pas retirées — le fichier est de
 * toute façon supprimé après la revue de l'admin.
 */
export async function saveProofFile(
  file: Express.Multer.File,
  options: { allowPdf?: boolean } = {},
): Promise<{ url: string; filePath: string; kind: ProofKind }> {
  const kind: ProofKind | null = detectImageKind(file.buffer) ?? (options.allowPdf && isPdf(file.buffer) ? 'pdf' : null)
  if (!kind) throw new ProofFileError(options.allowPdf ? PHOTO_OR_PDF_MESSAGE : PHOTO_ONLY_MESSAGE)
  const content = kind === 'jpg' ? stripJpegApp1(file.buffer) : file.buffer
  await mkdir(PROOF_DIR, { recursive: true })
  const fileName = `${randomUUID()}.${kind}`
  const filePath = path.join(PROOF_DIR, fileName)
  await writeFile(filePath, content)
  return { url: `/uploads/preuves/${fileName}`, filePath, kind }
}

/** Efface le fichier d'une preuve (purge, échec d'enregistrement). Silencieux si absent. */
export async function deleteProofFile(url: string | null | undefined): Promise<void> {
  if (!url) return
  const fileName = url.split('/').pop() ?? ''
  if (!PROOF_FILE_PATTERN.test(fileName)) return
  try {
    await unlink(path.join(PROOF_DIR, fileName))
  } catch {
    // Déjà absent : rien à faire.
  }
}
