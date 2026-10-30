# @dl-tlu/edtf-parser

Jagatud EDTF (Extended Date Time Format) teek dl.tlu.ee projektide jaoks.

Teisendab EDTF kuupäevastringid inimloetavaks tekstiks (eesti/inglise keeles), normaliseerib toorsisendit EDTF formaati ja pakub ühtset valideerimisregexi.

---

## Paigaldamine

Pakett **ei ole npm registris** ja seda ei kavatsetagi sinna panna: väljund ei ole
puhas standard-EDTF, sest teek sisaldab DL-i omi laiendusi (vt
[Erisused EDTF standardist](#erisused-edtf-standardist)). Kasutatakse git-tagi
järgi, tarball-URL-ina (ei vaja buildis `git`-i, nt `node:*-alpine` Docker image'is):

```json
"@dl-tlu/edtf-parser": "https://github.com/Digital-Livonia/edtf-parser/archive/refs/tags/v1.1.0.tar.gz"
```

Seejärel `npm install`. Lockfile lukustab tarballi räsi.

**Next.js projektis** lisada `next.config.js`-i (vajalik ESM paketi transpileerimiseks):
```js
transpilePackages: ['@dl-tlu/edtf-parser']
```

**Kohalik arendus** (muudatus korraga teeki ja kasutavasse projekti): `npm link`
või ajutiselt `"file:../edtf-parser"`. Commit'i ära ainult tarball-URL.

### Uue versiooni väljaandmine

1. Muudatus + testid (`npm test`), versioon `package.json`-is (semver)
2. `git tag vX.Y.Z && git push --tags`
3. Kasutavates projektides uuenda URL-is tag ja jooksuta `npm install`

Kasutajad: `dl-app`, `data-import`, plaanis `directus-iiif-endpoint`.

---

## Ekspordid

### `EDTF_REGEX`
Üks autoriteetne regex EDTF stringide valideerimiseks. Sama regexi kasutatakse andmete importimisel, CSV eelkontrollis ja `check-regex.mjs` testis. Sobib ka Directuse välja `_regex` valideerimiskonstrainiks.

```js
import { EDTF_REGEX } from '@dl-tlu/edtf-parser'

EDTF_REGEX.test('1470/1473')   // true
EDTF_REGEX.test('1321?')       // true
EDTF_REGEX.test('../1300')     // true
EDTF_REGEX.test('abc')         // false
```

**Toetatud mustrid (näited):**

| Sisend | Tähendus |
|--------|----------|
| `1985` | aasta |
| `1985-06` | aasta-kuu |
| `1985-06-11` | täiskuupäev |
| `1321?` | ebakindel aasta |
| `1321~` | ligikaudne aasta |
| `1470/1473` | intervall |
| `../1300` | kuni 1300 |
| `1533/..` | alates 1533 |
| `..1300` | kuni 1300 (alternatiivkuju) |
| `[1556,1557]` | üks kahest |
| `[1300..1500,1720..1809]` | üks kahest vahemikust (`..`, mitte `/`) |
| `[..1984]`, `[1760-12..]` | "enne 1984" / "pärast 1760. detsember": ajahetk, mis on antud väärtus või varasem/hilisem |
| `1303/[1312,1313]` | intervall, valik lõpus (DL laiendus) |
| `[1453,1465]/[1462,1473]` | valikud mõlemas otspunktis (DL laiendus) |
| `..1287/1314-11-26` | avatud algus, täiskuupäev lõpus |

---

### `normalizeEDTF(raw, { allowSetNotation })`
Normaliseerib toorandmeid (nt tabelarvutusest) kehtivaks EDTF stringiks.

```js
import { normalizeEDTF } from '@dl-tlu/edtf-parser'

normalizeEDTF('~1435')           // → '1435~'
normalizeEDTF('1470-1473')       // → '1470/1473'
normalizeEDTF('1483, 1520')      // → '1483/1520'
normalizeEDTF('..1533')          // → '../1533'
normalizeEDTF('1533..')          // → '1533/..'
normalizeEDTF('1483, 1520', { allowSetNotation: true })  // → '[1483,1520]'
normalizeEDTF('[1300/1500,1720/1809]')  // → '[1300..1500,1720..1809]'
```

**Parameeter `allowSetNotation`:** kui `true`, võib tagastada EDTF set-kuju `[a,b]`; vaikimisi teisendatakse intervalliks `a/b`.

---

### `parseEDTF(edtfString, locale)`
Teisendab EDTF stringi inimloetavaks tekstiks.

```js
import { parseEDTF } from '@dl-tlu/edtf-parser'

parseEDTF('1321?')         // → 'arvatavasti 1321'
parseEDTF('1321~')         // → 'umbes 1321'
parseEDTF('../1300')       // → 'kuni 1300'
parseEDTF('[..1300]')      // → 'enne 1300'
parseEDTF('1470/1473')     // → '1470 – 1473'
parseEDTF('[1556,1557]')   // → 'üks järgmistest: 1556, 1557'
parseEDTF('1985-06-11')    // → '11. juuni 1985'

parseEDTF('1321?', 'en')   // → 'uncertain 1321'
```

Vaikimisi lokaalne: `'et'`. Toetab ka `'en'`.

---

### `parseEDTFValue(value, locale)`
Nagu `parseEDTF`, aga käsitleb lisaks massiive ja null-väärtusi.

```js
import { parseEDTFValue } from '@dl-tlu/edtf-parser'

parseEDTFValue(['1470/1473', '1321?'])
// → ['1470 – 1473', 'arvatavasti 1321']
```

---

### `isEDTFPattern(str)`
Tagastab `true` kui string vastab mõnele toetatud EDTF mustrile. Kasutatakse UI-s otsustamiseks, kas väärtust üldse parsida.

```js
import { isEDTFPattern } from '@dl-tlu/edtf-parser'

isEDTFPattern('1470/1473')   // true
isEDTFPattern('Tallinn')     // false
```

---

## "Enne" ja "pärast" vs "kuni" ja "alates"

EDTF-is pole range "enne" (välistavat otsa). Kaks kuju tähendavad eri asja (#277):

| Kuju | Tähendus | Kuvatakse |
|------|----------|-----------|
| `../1543`, `/1543` | **periood**, mis lõpeb 1543 (kaasa arvatud) | kuni 1543 |
| `1543/..` | **periood**, mis algab 1543 | alates 1543 |
| `[..1543]` | **ajahetk** 1543 või varem (LoC: "on or before") | enne 1543 |
| `[1543..]` | **ajahetk** 1543 või hiljem ("on or after") | pärast 1543 |

**Kus kumb (DL andmed):** sünd, surm ja kinnisvara/pärusraamatu kuupäevad: avatud ots on alati
enne/pärast → `[..X]` / `[X..]`. Rollide ja ametite (`people_events`) algus või lõpp on periood →
`../X` ("kuni") ja `X/..` ("alates"); neid ei tehta hulgaks.

Allika "enne YYYY" / "pärast YYYY" (tehing, surm, sünd) on ajahetk, seega kirjutada
`[..YYYY]` / `[YYYY..]`. `../YYYY` ja `YYYY/..` jäävad perioodidele (ametiaeg,
omandiperiood). Rangelt YYYY välistav "enne" on ainult `../(YYYY-1)-12-31`.

## Erisused EDTF standardist

Need kujud **ei ole standardne EDTF**, kuid `EDTF_REGEX`, `isEDTFPattern` ja
`parseEDTF` aktsepteerivad neid teadlikult, sest need esinevad andmetes
(otsus: Digital-Livonia/dl-app#232, #253). Välised EDTF tööriistad võivad need
tagasi lükata.

| Kuju | Näide | Väljund (et) | Miks mittestandardne |
|------|-------|--------------|----------------------|
| Valik intervalli otspunktina | `[1453,1465]/[1462,1473]`, `1541-07-23/[1556,1557]` | `üks järgmistest: 1453, 1465 – üks järgmistest: 1462, 1473` | Spetsifikatsioon näitab otspunktidena ainult üksikkuupäevi |
| Lühendatud avatud intervall | `/1277`, `1277/`, `..1660/` | `kuni 1277`, `alates 1277`, `enne 1660 – lõpp teadmata` | Standardkujud on `../1277` ja `1277/..` |
| `..YYYY` intervalli otspunktina | `..1470/1473`, `1399/..1404-10-21` | | Spetsifikatsioonis on `..` ainult avatud otsana või valiku sees |

**Ei ole lubatud:** `/` valiku sees (`[1300/1500,1720/1809]`). Valiku sees
märgitakse vahemik `..`-ga (EDTF Level 2 "Set representation"). Kuni 5-aastased
vahemikud kuvatakse aastate kaupa (`[1670..1672]` → `1670, 1671, 1672`), pikemad
vahemikuna (`[1300..1500]` → `1300 – 1500`).

Toimetajale mõeldud kokkuvõte: [docs/EDTF_SISESTUSJUHEND.md](docs/EDTF_SISESTUSJUHEND.md).

---

## Abiskript: `check-regex.mjs`

Testib `EDTF_REGEX`-it teadaoleva valid/invalid väärtuste komplekti vastu. Kasutatakse Directuse välja valideerimisregexi uuendamisel või regex muutmisel.

```bash
node check-regex.mjs
```

---

## Testid

```bash
npm install
npm test        # vitest
npm run check-regex
```

NB: `check-regex.mjs`-is on teadaolev viga: `1985-13` (kuu 13) läbib regexi.

---

## Kasutamine projektides

### `data-import` ([`import.js`](https://github.com/Digital-Livonia/data-import/blob/HEAD/import.js))

```js
import { normalizeEDTF, EDTF_REGEX } from '@dl-tlu/edtf-parser'
```

- **`normalizeEDTF`** — kõik `_string`-lõpuga Directuse väljad normaliseeritakse automaatselt enne importi
- **`EDTF_REGEX`** — kasutatakse `--check-dates` lipuga kuupäevavalideerimiseks ja `hasRole` kirjete filtreerimiseks (fallback kui Directus regexi ei tagasta)

Abiskriptides:

| Skript | Kasutatav eksport |
|--------|-------------------|
| [`scripts/check-edtf-columns.js`](https://github.com/Digital-Livonia/data-import/blob/HEAD/scripts/check-edtf-columns.js) | `EDTF_REGEX` |
| [`scripts/check-edtf-parse.js`](https://github.com/Digital-Livonia/data-import/blob/HEAD/scripts/check-edtf-parse.js) | `parseEDTF` |

---

### `dl-app` (Next.js)

| Komponent | Kasutatav eksport |
|-----------|-------------------|
| [`components/dates/EDTFValue.js`](https://github.com/Digital-Livonia/dl-app/blob/HEAD/components/dates/EDTFValue.js) | `parseEDTFValue` |
| [`components/content/table/Value.js`](https://github.com/Digital-Livonia/dl-app/blob/HEAD/components/content/table/Value.js) | `isEDTFPattern`, `parseEDTF` |

---

## Täpsem dokumentatsioon

Vaata [`edtfParser.md`](./docs/edtfParser.md) — EDTF mustrite täielik nimekiri, Directuse seadistus ja kasutuspõhimõtted.
