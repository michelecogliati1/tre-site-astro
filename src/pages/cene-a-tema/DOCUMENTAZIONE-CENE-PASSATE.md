# Sistema Cene Passate - Documentazione Completa

## Panoramica

Questo sistema permette di gestire dinamicamente le pagine delle cene passate tramite Google Sheets.
Ogni cena è identificata da uno **slug** univoco (es: `oktoberfest`, `natale`, `san-valentino`).

---

## 1. Struttura del Foglio Google Sheet

### Creare il nuovo foglio "CenePassate"

Nel tuo Google Sheet esistente (`TRE_-_Menù_Ristorante`), crea un nuovo foglio chiamato **CenePassate**.

### Colonne del foglio

| Colonna A | Colonna B | Colonna C | Colonna D | Colonna E | Colonna F |
|-----------|-----------|-----------|-----------|-----------|-----------|
| slug | categoria | campo1 | campo2 | campo3 | campo4 |

### Categorie disponibili

| Categoria | campo1 | campo2 | campo3 | campo4 |
|-----------|--------|--------|--------|--------|
| **info** | Titolo cena | Data completa | Orario | Prezzo |
| **seo** | Meta Title | Meta Description | - | - |
| **images** | Hero image path | CTA image path | - | - |
| **schema** | startDateISO | endDateISO | - | - |
| **portata** | Tipo portata | Nome piatto | Abbinamento | - |

---

## 2. Esempio Completo: Oktoberfest

Ecco come compilare il foglio per la cena Oktoberfest:

| slug | categoria | campo1 | campo2 | campo3 | campo4 |
|------|-----------|--------|--------|--------|--------|
| oktoberfest | info | Oktoberfest | Venerdì 18 Ottobre 2024 | ore 20.00 | 50,00 |
| oktoberfest | seo | Cena a Tema Oktoberfest - 18 Ottobre 2024 \| TRE Grill + Pizzeria | Rivivi la serata Oktoberfest del 18 Ottobre 2024 al Ristorante TRE Merate. Menù bavarese con birre artigianali selezionate. | | |
| oktoberfest | images | /img/cene-tema/oktoberfest/cena-tema-oktoberfest-ristorante-pizzeria-tre-merate-hero.webp | /img/cene-tema/oktoberfest/cene-tema-ristorante-pizzeria-tre-merate-prenota-tavolo.webp | | |
| oktoberfest | schema | 2024-10-18T20:00:00+02:00 | 2024-10-18T23:30:00+02:00 | | |
| oktoberfest | portata | Aperitivo | Obatzda (crema di formaggi bavaresi) con crostini di segale | Tegernseer Hell – Herzoglich Bayerisches Brauhaus Tegernsee | |
| oktoberfest | portata | Antipasto | Brezel caldo con burro aromatizzato e senape dolce | Weihenstephaner Hefeweissbier – Weihenstephan | |
| oktoberfest | portata | Primo | Zuppa di patate e porri con pancetta croccante | Kellerbier – Ayinger | |
| oktoberfest | portata | Secondo | Stinco di maiale al forno con crauti e patate | Celebrator Doppelbock – Ayinger | |
| oktoberfest | portata | Dessert | Strudel di mele con crema alla vaniglia | Eisbock – Schneider Weisse | |
| oktoberfest | portata | Caffè | | | |

---

## 3. Aggiungere una Nuova Cena

### Passo 1: Aggiungi i dati nel Google Sheet

Copia le righe dell'Oktoberfest e modifica:
1. Lo **slug** (es: `natale`, `san-valentino`, `pesce`)
2. I dati della categoria **info** (titolo, data, ora, prezzo)
3. I dati SEO
4. I percorsi delle immagini
5. Le date ISO per Schema.org
6. Le portate

### Passo 2: Crea la cartella e le immagini

```
public/
└── img/
    └── cene-tema/
        └── [nuovo-slug]/
            ├── cena-tema-[slug]-ristorante-pizzeria-tre-merate-hero.webp
            └── cene-tema-ristorante-pizzeria-tre-merate-prenota-tavolo.webp
```

### Passo 3: Crea la pagina Astro

Duplica il template e modifica solo lo slug:

```
src/pages/cene-a-tema/[nuovo-slug]/index.astro
```

Nel file, cambia solo questa riga:
```typescript
const SLUG = "nuovo-slug"; // <-- Il tuo nuovo slug
```

---

## 4. Formato Date ISO per Schema.org

Le date devono essere in formato ISO 8601 con timezone:

```
YYYY-MM-DDTHH:MM:SS+02:00
```

Esempi:
- `2024-10-18T20:00:00+02:00` (18 Ottobre 2024, ore 20:00)
- `2024-12-24T19:30:00+01:00` (24 Dicembre 2024, ore 19:30)

**Nota:** In inverno usa `+01:00`, in estate (ora legale) usa `+02:00`.

---

## 5. Ottenere il GID del Foglio

Dopo aver creato il foglio "CenePassate":

1. Apri il foglio nel browser
2. Guarda l'URL: `https://docs.google.com/spreadsheets/d/[ID]/edit#gid=[GID]`
3. Copia il numero dopo `gid=`
4. Inseriscilo in `googleSheets.ts`:

```typescript
export const SHEET_GIDS = {
  // ... altri fogli
  cenePassate: "1234567890"  // <-- Il tuo GID
};
```

---

## 6. Troubleshooting

### I dati non si aggiornano
- Verifica che il GID sia corretto
- Attendi 2-3 minuti (cache del build)
- Controlla la console per errori

### Le immagini non appaiono
- Verifica che i percorsi nel Google Sheet siano corretti
- Assicurati che le immagini esistano nella cartella `public/img/cene-tema/[slug]/`

### Schema.org non valido
- Usa il [Rich Results Test](https://search.google.com/test/rich-results) di Google
- Verifica il formato delle date ISO
- Controlla che i prezzi usino il punto come separatore decimale nel JSON (il sistema lo converte automaticamente)

---

## 7. Esempio Template Oktoberfest Aggiornato

Dopo l'implementazione, il file `oktoberfest/index.astro` diventa semplicemente:

```astro
---
import Layout from "../../../layouts/Layout.astro";
import { 
  getCenaPassataBySlug, 
  generateCenaPassataSchemaOrg 
} from "../../../utils/googleSheets";

const SLUG = "oktoberfest";
const cena = await getCenaPassataBySlug(SLUG);

// ... rest of template (vedi file completo)
---
```

Tutto il resto è gestito automaticamente dal Google Sheet!

---

## 8. Checklist per Nuova Cena

- [ ] Aggiunte righe nel foglio Google Sheet con slug corretto
- [ ] Categoria `info` compilata (titolo, data, ora, prezzo)
- [ ] Categoria `seo` compilata (title, description)
- [ ] Categoria `images` compilata (percorsi immagini)
- [ ] Categoria `schema` compilata (date ISO)
- [ ] Categorie `portata` aggiunte (una per ogni portata)
- [ ] Creata cartella immagini in `public/img/cene-tema/[slug]/`
- [ ] Caricate le immagini (hero e cta)
- [ ] Creato file Astro con slug corretto
- [ ] Build e deploy eseguiti
- [ ] Verificata pagina live
- [ ] Testato Schema.org con Rich Results Test
