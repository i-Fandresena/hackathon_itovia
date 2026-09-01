/// <reference types="node" />

/**
 * `@types/pdf-parse` ne déclare que le point d'entrée racine du paquet.
 * On importe volontairement `pdf-parse/lib/pdf-parse.js` (voir
 * `routes/auth.routes.ts`) pour contourner le code de debug de l'index —
 * ce fichier reprend simplement la même signature pour ce sous-chemin.
 */
declare module 'pdf-parse/lib/pdf-parse.js' {
  function PdfParse(
    dataBuffer: Buffer,
    options?: {
      pagerender?: ((pageData: unknown) => string | Promise<string>) | undefined
      max?: number | undefined
      version?: string | undefined
    },
  ): Promise<{
    numpages: number
    numrender: number
    info: unknown
    metadata: unknown
    version: string
    text: string
  }>
  export = PdfParse
}
