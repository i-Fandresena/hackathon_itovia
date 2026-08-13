# Guide de collecte — 200 premières recommandations

Objectif : remplir l'annuaire **avant** l'ouverture. Un annuaire vide n'a aucune
valeur ; personne ne revient sur une page de résultats blanche.

Ce guide est destiné aux personnes qui vont sur le terrain. Le fichier
[`modele-collecte.csv`](./modele-collecte.csv) est le support de saisie
(ouvrable dans Excel, LibreOffice ou Google Sheets).

---

## 1. Viser la profondeur, pas le nombre de fiches

L'erreur naturelle est de collecter 200 recommandations sur 200 prestataires
différents. Résultat : 200 fiches à un seul avis, toutes marquées « confiance
faible », donc aucune fiche crédible.

**La cible est l'inverse :**

| | Cible |
|---|---|
| Recommandations | 200 |
| Prestataires distincts | **40 à 50** |
| Recommandations par prestataire | **3 à 5** |
| Membres interrogés distincts | 60 minimum |
| Métiers couverts | 8 à 10 |
| Zone | Agglomération d'Antananarivo uniquement |

Concrètement : quand quelqu'un vous cite un maçon, demandez systématiquement
« qui d'autre le connaît ? » et allez voir cette personne. On remonte les
chaînes de bouche-à-oreille existantes plutôt que d'ouvrir des fiches isolées.

**Plafond : 3 recommandations maximum par personne interrogée.** Un
enthousiaste qui remplit 20 fiches déforme tout l'annuaire.

---

## 2. Le questionnaire

Suivre l'ordre. Ne pas souffler les réponses.

1. **« Sur vos 12 derniers mois de travaux, quel prestataire recommanderiez-vous
   les yeux fermés ? »**
   Question ouverte, un seul nom pour commencer. → `prestataire_nom`, `prestataire_metier`

2. **« Qu'est-ce qu'il a fait exactement pour vous ? »**
   Exiger une quantité, une surface ou une durée. « Des travaux de maçonnerie »
   ne suffit pas ; « le mur de clôture de 40 m » oui. → `travail`

3. **« C'était quand ? »**
   Mois et année suffisent. Si le jour est inconnu, saisir le 15.
   → `date_chantier`

4. **« Combien avez-vous payé, et pour quelle unité ? »**
   C'est la question la plus utile de l'entretien et la plus souvent esquivée.
   Insister une fois, puis laisser vide si la personne refuse.
   → `prix_paye`, `prix_unite`

5. **« Est-ce que vous le reprendriez pour un prochain chantier ? »**
   → `reprendrait`

6. **« Qu'est-ce qui s'est bien passé, et qu'est-ce qui s'est moins bien
   passé ? »**
   **Les deux volets sont obligatoires.** Sans la seconde moitié, on ne récolte
   que des éloges et l'annuaire perd toute crédibilité. Si la personne ne
   trouve rien de négatif, écrire « rien à signaler selon le membre ».
   → `commentaire`

7. **« Vous avez encore la facture, ou une photo du travail ? »**
   Photographier le document sur place. Nommer le fichier et reporter ce nom.
   → `preuve`, `preuve_reference`

8. **« Vous avez son numéro ? »** → `prestataire_telephone`, `prestataire_whatsapp`

9. **Consentements** (voir § 4). → `consentement_membre`, `accord_prestataire`

---

## 3. Les colonnes

Une ligne = **une recommandation**. Les colonnes `prestataire_*` sont donc
répétées à l'identique sur chaque ligne concernant le même prestataire — c'est
normal, l'import les regroupe.

| Colonne | Obligatoire | Format |
|---|---|---|
| `collecteur` | oui | prénom de l'enquêteur |
| `date_collecte` | oui | `AAAA-MM-JJ` |
| `consentement_membre` | oui | `oui` / `non` |
| `accord_prestataire` | oui | `oui` / `non` |
| `prestataire_nom` | oui | tel qu'on le désigne localement |
| `prestataire_metier` | oui | valeur de la liste `TRADES` |
| `prestataire_quartier` | oui | valeur de la liste `DISTRICTS` |
| `prestataire_telephone` | oui | `+261 XX XX XXX XX` |
| `prestataire_whatsapp` | non | idem, vide si pas de WhatsApp |
| `prestataire_description` | oui | 1 à 2 phrases factuelles |
| `membre_nom_affiche` | oui | **prénom + initiale** — c'est ce qui sera public |
| `membre_nom_complet` | oui | **ne sera jamais publié** (§ 4) |
| `membre_telephone` | oui | **ne sera jamais publié**, sert à la vérification |
| `membre_quartier` | oui | valeur de la liste `DISTRICTS` |
| `membre_telephone_verifie` | oui | `oui` si vous avez appelé le numéro |
| `travail` | oui | 8 caractères min., avec quantité / surface / durée |
| `date_chantier` | oui | `AAAA-MM-JJ`, jamais dans le futur |
| `note` | oui | entier de 1 à 5 |
| `reprendrait` | oui | `oui` / `non` |
| `prix_paye` | non | entier, en Ariary, sans espace ni « Ar » |
| `prix_unite` | si prix | valeur de la liste `PRICE_UNITS` |
| `preuve` | oui | `facture` / `photo` / `aucune` |
| `preuve_reference` | si preuve | nom du fichier photographié |
| `commentaire` | oui | 40 caractères min., entre guillemets droits |

Séparateur : **point-virgule** (`;`). Les commentaires contiennent des virgules,
ils doivent être entourés de guillemets droits `"`.

Listes de valeurs autorisées : [`src/data/constants.ts`](../src/data/constants.ts)
(`TRADES`, `DISTRICTS`, `PRICE_UNITS`).

---

## 4. Consentement et données personnelles

Deux accords distincts, tous deux nécessaires avant publication :

- **`consentement_membre`** — la personne accepte que son témoignage soit publié
  sous un nom abrégé (« Hery R. »). Lui montrer à quoi ressemble une fiche.
- **`accord_prestataire`** — le prestataire accepte que son nom et son numéro
  soient publiés. **Il faut l'appeler.** C'est aussi l'occasion de vérifier que
  le numéro fonctionne et qu'il travaille encore.

Une ligne dont l'un des deux accords vaut `non` **n'est pas importée**. Elle
reste dans le fichier pour mémoire — elle indique un prestataire à recontacter.

`membre_nom_complet` et `membre_telephone` servent uniquement à vérifier
l'identité et à détecter les doublons. Ils ne sortent jamais du fichier de
collecte : le script d'import ne les recopie pas.

---

## 5. Ce qui est refusé

Le script d'import rejette automatiquement :

- une ligne sans `date_chantier`, ou avec une date future ;
- un `commentaire` de moins de 40 caractères ;
- un `travail` vague de moins de 8 caractères ;
- un `prix_paye` sans `prix_unite` ;
- le même membre recommandant deux fois le même prestataire ;
- une ligne sans les deux consentements.

À refuser vous-même sur le terrain, avant saisie :

- **le commentaire creux.** « Il est gentil et sérieux » ne contient aucune
  information. Relancer : *qu'est-ce qui vous fait dire ça ?*
- **le ouï-dire.** « Mon cousin dit qu'il est bon » n'est pas une expérience
  vécue. Aller voir le cousin.
- **le conflit d'intérêt.** Ne pas collecter auprès de sa propre famille, ni sur
  une entreprise dans laquelle on a un intérêt. Le noter si le doute existe.
- **le chantier de plus de 3 ans.** L'information n'est plus fiable.

---

## 6. Importer

```bash
node collecte/import-collecte.mjs collecte/modele-collecte.csv
```

Le script valide chaque ligne, affiche les erreurs avec leur numéro de ligne, et
écrit `collecte/sortie/annuaire.json` (membres, prestataires, recommandations)
prêt à charger dans Supabase ou à substituer aux données de démonstration.

Il signale aussi les prestataires qui n'ont qu'une seule recommandation : ce
sont vos prochaines cibles de terrain.
