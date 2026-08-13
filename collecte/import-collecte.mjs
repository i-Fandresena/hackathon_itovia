#!/usr/bin/env node
/**
 * Convertit un fichier de collecte terrain (CSV point-virgule) vers le modèle
 * de l'annuaire. Voir GUIDE-COLLECTE.md pour le format des colonnes.
 *
 *   node collecte/import-collecte.mjs collecte/modele-collecte.csv
 *
 * Rien n'est écrit tant qu'une ligne est invalide : on préfère renvoyer le
 * collecteur sur le terrain plutôt que d'importer une donnée douteuse.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const TRADES = new Set([
  'Fournisseur de briques',
  'Fournisseur ciment / fer',
  'Maçon',
  'Charpentier',
  'Menuisier',
  'Plombier',
  'Électricien',
  'Peintre',
  'Carreleur',
  'Soudeur / ferronnier',
  'Transport de matériaux',
  'Terrassement',
  'Puisatier',
  'Dessinateur / architecte',
])

const PRICE_UNITS = new Set([
  'par unité',
  'par brique',
  'par sac',
  'par m²',
  'par m³',
  'par jour',
  'par voyage',
  'forfait',
])

const PROOFS = new Set(['facture', 'photo', 'aucune'])
const MIN_COMMENT = 40
const MIN_JOB = 8
const MAX_AGE_YEARS = 3

/** Parseur CSV minimal : séparateur `;`, guillemets droits échappés par `""`. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
      continue
    }
    if (c === '"') quoted = true
    else if (c === ';') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const digits = (v) => v.replace(/\D/g, '')
const isYes = (v) => v.trim().toLowerCase() === 'oui'

function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage : node collecte/import-collecte.mjs <fichier.csv>')
    process.exit(1)
  }

  const rows = parseCsv(readFileSync(resolve(input), 'utf8'))
  const header = rows.shift().map((h) => h.trim())
  const col = (r, name) => (r[header.indexOf(name)] ?? '').trim()

  const errors = []
  const skipped = []
  const members = new Map()
  const providers = new Map()
  const recommendations = []
  const seenPairs = new Set()

  const today = new Date().toISOString().slice(0, 10)
  const oldest = new Date(Date.now() - MAX_AGE_YEARS * 365 * 864e5)
    .toISOString()
    .slice(0, 10)

  rows.forEach((r, i) => {
    const line = i + 2 // +1 en-tête, +1 pour compter à partir de 1
    const fail = (msg) => errors.push(`ligne ${line} — ${msg}`)

    if (!isYes(col(r, 'consentement_membre')) || !isYes(col(r, 'accord_prestataire'))) {
      skipped.push(
        `ligne ${line} — ${col(r, 'prestataire_nom') || '?'} : consentement manquant, à recontacter`,
      )
      return
    }

    const providerName = col(r, 'prestataire_nom')
    const trade = col(r, 'prestataire_metier')
    const providerDistrict = col(r, 'prestataire_quartier')
    const memberPhone = col(r, 'membre_telephone')
    const jobLabel = col(r, 'travail')
    const jobDate = col(r, 'date_chantier')
    const rating = Number(col(r, 'note'))
    const price = col(r, 'prix_paye')
    const priceUnit = col(r, 'prix_unite')
    const proof = col(r, 'preuve')
    const comment = col(r, 'commentaire')

    if (!providerName) fail('prestataire_nom vide')
    if (!TRADES.has(trade)) fail(`métier inconnu : « ${trade} »`)
    if (!providerDistrict) fail('prestataire_quartier vide')
    if (!col(r, 'prestataire_telephone')) fail('prestataire_telephone vide')
    if (!col(r, 'membre_nom_affiche')) fail('membre_nom_affiche vide')
    if (!memberPhone) fail('membre_telephone vide (sert à détecter les doublons)')
    if (jobLabel.length < MIN_JOB) fail(`travail trop vague : « ${jobLabel} »`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) fail('date_chantier absente ou mal formée')
    else if (jobDate > today) fail('date_chantier dans le futur')
    else if (jobDate < oldest) fail(`chantier de plus de ${MAX_AGE_YEARS} ans`)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail('note hors 1–5')
    if (!['oui', 'non'].includes(col(r, 'reprendrait').toLowerCase())) {
      fail('reprendrait doit valoir oui ou non')
    }
    if (price && !PRICE_UNITS.has(priceUnit)) fail('prix_paye sans prix_unite valide')
    if (price && !(Number(price) > 0)) fail('prix_paye invalide')
    if (!PROOFS.has(proof)) fail(`preuve inconnue : « ${proof} »`)
    if (proof !== 'aucune' && !col(r, 'preuve_reference')) {
      fail('preuve annoncée sans preuve_reference')
    }
    if (comment.length < MIN_COMMENT) {
      fail(`commentaire trop court (${comment.length}/${MIN_COMMENT})`)
    }

    const memberId = `member-${digits(memberPhone)}`
    const providerId = `prov-${slug(`${providerName}-${providerDistrict}`)}`

    const pair = `${memberId}|${providerId}`
    if (seenPairs.has(pair)) {
      fail(`${col(r, 'membre_nom_affiche')} recommande deux fois ${providerName}`)
      return
    }
    seenPairs.add(pair)

    // Le nom complet et le téléphone du membre restent dans le CSV : ils ne
    // sont pas recopiés ici.
    if (!members.has(memberId)) {
      members.set(memberId, {
        id: memberId,
        displayName: col(r, 'membre_nom_affiche'),
        district: col(r, 'membre_quartier'),
        city: 'Antananarivo',
        joinedAt: `${col(r, 'date_collecte')}T08:00:00Z`,
        phoneVerified: isYes(col(r, 'membre_telephone_verifie')),
      })
    }

    if (!providers.has(providerId)) {
      providers.set(providerId, {
        id: providerId,
        name: providerName,
        trade,
        description: col(r, 'prestataire_description'),
        district: providerDistrict,
        city: 'Antananarivo',
        province: 'Antananarivo',
        phone: col(r, 'prestataire_telephone'),
        whatsapp: col(r, 'prestataire_whatsapp') || undefined,
        addedByMemberId: memberId,
        createdAt: `${col(r, 'date_collecte')}T08:00:00Z`,
      })
    }

    recommendations.push({
      id: `rec-${slug(`${providerId}-${memberId}`)}`,
      providerId,
      authorMemberId: memberId,
      authorName: col(r, 'membre_nom_affiche'),
      authorDistrict: col(r, 'membre_quartier'),
      rating,
      wouldUseAgain: isYes(col(r, 'reprendrait')),
      jobLabel,
      jobDate,
      pricePaid: price ? Number(price) : undefined,
      priceUnit: price ? priceUnit : undefined,
      comment,
      proof,
      confirmations: [],
      createdAt: `${col(r, 'date_collecte')}T08:00:00Z`,
    })
  })

  for (const s of skipped) console.log(`~ ${s}`)

  if (errors.length) {
    console.error(`\n${errors.length} erreur(s), rien n’a été importé :\n`)
    for (const e of errors) console.error(`  × ${e}`)
    process.exit(1)
  }

  const counts = new Map()
  for (const rec of recommendations) {
    counts.set(rec.providerId, (counts.get(rec.providerId) ?? 0) + 1)
  }
  const thin = [...counts.entries()].filter(([, n]) => n < 3)

  const out = resolve('collecte/sortie/annuaire.json')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(
    out,
    JSON.stringify(
      {
        members: [...members.values()],
        providers: [...providers.values()],
        recommendations,
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log(
    `\n✓ ${recommendations.length} recommandations · ${providers.size} prestataires · ${members.size} membres`,
  )
  console.log(`  → ${out}`)

  if (thin.length) {
    console.log(
      `\n${thin.length} prestataire(s) sous le seuil de 3 recommandations — prochaines cibles de terrain :`,
    )
    for (const [id, n] of thin) {
      console.log(`  · ${providers.get(id).name} (${n})`)
    }
  }
}

main()
