# EDTF Parser Implementation Guide

## Overview
Extended Date Time Format (EDTF) is a standard for representing dates with uncertainty, approximation, and intervals. This implementation supports **EDTF Level 1 and Level 2** patterns and automatically transforms them into human-readable Estonian or English text.

## Directus Setup

### Configuration: `dates_setup` Table
All EDTF date fields are configured in a single `dates_setup` table in Directus:

- **Table name:** `dates_setup`
- **Type:** Singleton (single global configuration)
- **Field:** `date_fields` (array of field definitions)

Each entry in `date_fields` contains:
```
{ date_field: "field_name" }
```

### Example Configuration
```
dates_setup (id: 1)
├─ date_fields:
   ├─ { date_field: "date" }
   ├─ { date_field: "birth_string" }
   ├─ { date_field: "death_string" }
   └─ { date_field: "edtf_date" }
```

**These fields are applied globally to all collections** - any collection with these field names will have EDTF parsing applied automatically.

## Usage Patterns

### Pattern 1: In Server-Side Data Fetching (Recommended)
Apply EDTF parsing after fetching data - fields are determined automatically from `dates_setup`:

```javascript
// pages/[type]/[collection]/[id].js
import { applyEDTFParsing } from '../../../lib/directusHelpers'

export async function getServerSideProps({ params, locale }) {
  let item = await getItemById(params.collection, params.id);
  
  // Apply EDTF parsing - automatically reads dates_setup table
  item = await applyEDTFParsing(item, locale);

  return { props: { item, locale } };
}
```

No need to configure field names - they're read from Directus `dates_setup` table automatically!

### Pattern 2: Using the Component
For display only, use the `EDTFValue` component:

```jsx
import EDTFValue from '../../components/dates/EDTFValue'

export default function DetailPage({ item, locale }) {
  return (
    <div>
      <h3>Dating</h3>
      <EDTFValue value={item.dating} locale={locale} />
    </div>
  )
}
```

### Pattern 3: In Data Lists/Tables
Apply to each item before rendering:

```jsx
import { parseEDTFValue } from '../../lib/edtfParser'

export default function ResultsTable({ results, edtfFields, locale }) {
  return results.map(item => (
    <tr key={item.id}>
      {edtfFields.includes('dating') && (
        <td>{parseEDTFValue(item.dating, locale)}</td>
      )}
    </tr>
  ))
}
```

## Supported EDTF Patterns

### Level 1 Patterns

#### Before/After and Until/From (Open Intervals)

`enne` / `pärast` is a **point in time** (EDTF set `[..X]` / `[X..]`, "on or before/after").
`kuni` / `alates` is a **period** (open-ended interval). Source dates saying "enne YYYY" / "pärast YYYY"
must be written as sets (Digital-Livonia/dl-app#277, see README).

| Pattern | Näide | Eesti | Inglise |
|---------|-------|-------|---------|
| Enne (point in time) | `[..1277]` | `enne 1277` | `before 1277` |
| Pärast (point in time) | `[1985..]` | `pärast 1985` | `after 1985` |
| Kuni (period, open start) | `../1277` | `kuni 1277` | `until 1277` |
| Kuni (algus teadmata) | `/1660` | `kuni 1660` | `until 1660` |
| Kuni (täiskuupäev) | `../1568-07-03` | `kuni 03. juuli 1568` | `until 03. July 1568` |
| Alates (period, open end) | `1985/..` | `alates 1985` | `from 1985` |
| Alates (lühivorm) | `1985/` | `alates 1985` | `from 1985` |
| Enne YYYY, lõpp teadmata | `..1660/` | `enne 1660 – lõpp teadmata` | `before 1660 to unknown end` |

> **Märkus:** `..1660/` on **vahemik** – algus on avatud ja lõpp teadmata. See erineb `../1660`-st (periood, mis lõpeb 1660) ja `[..1660]`-st (ajahetk 1660 või varem).

#### Uncertain/Approximate
| Pattern | Example | Estonian | English |
|---------|---------|----------|---------|
| Uncertain | `1984?` | `umbes 1984` | `uncertain 1984` |
| Approximate | `1984~` | `ligikaudu 1984` | `approximately 1984` |
| Both | `1984?~` | `umbes ligikaudu 1984` | `uncertain approximately 1984` |

#### Month/Day Precision
| Pattern | Example | Estonian | English |
|---------|---------|----------|---------|
| Month | `1550-09` | `september 1550` | `September 1550` |
| Full Date | `1550-09-15` | `15. september 1550` | `15. September 1550` |

#### Intervals
| Pattern | Näide | Eesti | Inglise |
|---------|-------|-------|---------|
| Aastavalik | `1700/1800` | `1700 - 1800` | `1700 to 1800` |
| Ligikaudne vahemik | `1700~/1800~` | `ligikaudu 1700 - ligikaudu 1800` | `approximately 1700 to approximately 1800` |
| Kuuvahemik | `1700-01/1800-12` | `jaanuar 1700 - detsember 1800` | `January 1700 to December 1800` |
| Täpne kuupäev kuni valik | `1541-07-23/[1556,1557]` | `23. juuli 1541 - üks järgmistest: 1556, 1557` | `23. July 1541 to one of: 1556, 1557` |
| Enne YYYY, lõpp teadmata | `..1660/` | `enne 1660 - lõpp teadmata` | `before 1660 to unknown end` |
| Kompleks intervall | `..1700?/1800~` | `enne arvatavasti 1700 – umbes 1800` | `before uncertain 1700 to approximately 1800` |

#### Negative Years (BCE)
| Pattern | Example | Estonian | English |
|---------|---------|----------|---------|
| BCE | `-1987` | `20. sajand e.m.a.` | `20th century BCE` |

### Level 2 Patterns

#### Choice (One of)
| Pattern | Example | Estonian |
|---------|---------|----------|
| Set | `[1667, 1668, 1670..1672]` | `üks järgmistest: 1667, 1668, 1670, 1671, 1672` |

#### Internal Uncertainty
| Pattern | Example | Description |
|---------|---------|----------|
| Range with Uncertainty | `{1667..1672}` | Uncertain range between 1667-1672 |

## Implementation Details

### Files Created/Modified

1. **`lib/edtfParser.js`** - Core parser with translation support
   - `parseEDTF(edtfString, locale)` - Main parser function
   - `parseEDTFValue(value, locale)` - Handles arrays and objects
   - Support for Estonian and English output

2. **`lib/directusHelpers.js`** - Integration helper
   - `applyEDTFParsing(data, edtfFieldNames, locale)` - Apply parsing to data objects
   - Handles comma-separated field names
   - Non-mutating transformation

3. **`components/dates/EDTFValue.js`** - React component
   - Props: `value`, `locale`, `className`
   - Handles arrays and single values
   - Ready to use in JSX

### Language Support
- **Estonian:** `locale = 'et'`
- **English:** `locale = 'en'`

Translations are hardcoded in `lib/edtfParser.js` for immediate rendering without API calls.

## Translation Keys

### Estonian
- `enne` = before
- `pärast` = after
- `ligikaudu` = approximately
- `umbes` = uncertain
- `-` = to/range separator

### English
- `before` = before
- `after` = after
- `approximately` = approximately
- `uncertain` = uncertain
- `to` = to/range separator

## Error Handling

If an EDTF value doesn't match any pattern:
- The original string is returned as-is
- No error is thrown
- Graceful fallback for partial/invalid EDTF

## Example Usage in Pages

### Detail Page with Multiple Date Fields
```javascript
// pages/[type]/[collection]/[id].js
import { applyEDTFParsing } from '../../../lib/directusHelpers'

export async function getServerSideProps({ params, locale }) {
  const item = await getItemData(params.collection, params.id)
  
  // EDTF parsing is applied automatically to all configured fields
  const transformedItem = await applyEDTFParsing(item, locale)
  
  return { props: { item: transformedItem, locale } }
}

export default function DetailPage({ item, locale }) {
  return (
    <>
      {item.birth_string && <p>Born: {item.birth_string}</p>}
      {item.death_string && <p>Died: {item.death_string}</p>}
      {item.edtf_date && <p>Dating: {item.edtf_date}</p>}
    </>
  )
}
```

### Search Results with EDTF Dates
```javascript
// pages/[type]/search.js
import EDTFValue from '../../../components/dates/EDTFValue'

export default function SearchResults({ results, edtfFields, locale }) {
  return (
    <table>
      <tbody>
        {results.map(item => (
          <tr key={item.id}>
            <td>{item.name}</td>
            {edtfFields?.includes('dating') && (
              <td><EDTFValue value={item.dating} locale={locale} /></td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

## Testing Patterns

```javascript
import { parseEDTF } from './lib/edtfParser'

// Avatud intervallid
console.log(parseEDTF('../1277', 'et'))           // kuni 1277
console.log(parseEDTF('/1660', 'et'))             // kuni 1660
console.log(parseEDTF('[..1277]', 'et'))          // enne 1277
console.log(parseEDTF('[1985..]', 'et'))          // pärast 1985
console.log(parseEDTF('1552/', 'et'))             // alates 1552
console.log(parseEDTF('1985/..', 'et'))           // alates 1985

// Vahemik: enne YYYY, lõpp teadmata
console.log(parseEDTF('..1660/', 'et'))           // enne 1660 - lõpp teadmata
console.log(parseEDTF('..1569/', 'et'))           // enne 1569 - lõpp teadmata
console.log(parseEDTF('..1660~/', 'et'))          // enne umbes 1660 – lõpp teadmata

// Vahemikud
console.log(parseEDTF('1700~/1800~', 'et'))       // ligikaudu 1700 - ligikaudu 1800
console.log(parseEDTF('..1700?/1800~', 'et'))     // enne arvatavasti 1700 – umbes 1800

// Kuu/päev täpsus
console.log(parseEDTF('1550-09', 'et'))           // september 1550
console.log(parseEDTF('1550-09-15', 'et'))        // 15. september 1550

// Ebakindlus
console.log(parseEDTF('1984?', 'en'))             // uncertain 1984
console.log(parseEDTF('1984~', 'et'))             // ligikaudu 1984

// Muud
console.log(parseEDTF('-1987', 'et'))             // 20. sajand e.m.a.
console.log(parseEDTF('[1667, 1668, 1670..1672]', 'et'))  // üks järgmistest: 1667, 1668, 1670, 1671, 1672
```

Testide käivitamine:
```bash
node edtfParser.test.js
```

## Next Steps

1. Add `edtf_fields` text field to your `databases` Directus table
2. Configure which collections have EDTF fields (e.g., `dating, date_range`)
3. Import and use `applyEDTFParsing` in your page `getServerSideProps`
4. Or use `EDTFValue` component directly in templates
5. Test with sample EDTF values from your collections

## Notes

- EDTF parsing is applied **during rendering**, not at build time
- Performance is negligible; parser runs synchronously
- All translations are embedded; no external API calls needed
- Component is language-aware via `locale` prop
- Works with nested data and arrays
