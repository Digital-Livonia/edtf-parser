# EDTF kuupäevade sisestamine (toimetajale)

Kuupäevaväljad (`date_string`, `birth_string`, `death_string`, `edtf_date` jt)
kasutavad [EDTF](https://www.loc.gov/standards/datetime/) vormingut. Veebilehel
kuvatakse need loetava tekstina. Kui väärtust ei õnnestu tõlgendada, kuvatakse
see muutmata kujul.

## Levinumad kujud

| Tähendus | Sisesta | Kuvatakse |
|----------|---------|-----------|
| Aasta | `1550` | 1550 |
| Kuu / päev | `1550-09` / `1550-09-15` | september 1550 / 15. september 1550 |
| Umbes / arvatavasti | `1550~` / `1550?` | umbes 1550 / arvatavasti 1550 |
| Vahemik | `1700/1800` | 1700 – 1800 |
| Kuni / alates (periood) | `../1277` / `1985/..` | kuni 1277 / alates 1985 |
| Enne / pärast (ajahetk) | `[..1543]` / `[1511..]` | enne 1543 / pärast 1511 |
| Üks mitmest aastast | `[1556,1557]` | üks järgmistest: 1556, 1557 |
| Üks mitmest vahemikust | `[1300..1500,1720..1809]` | üks järgmistest: 1300 – 1500, 1720 – 1809 |

## Enne / pärast vs kuni / alates

- **Enne / pärast** on üks ajahetk, mis jääb antud aasta ette või taha (nt tehing, surm):
  `[..1543]` → "enne 1543", `[1511..]` → "pärast 1511".
- **Kuni / alates** on periood (nt ametiaeg, omand): `../1543` → "kuni 1543".
- Kui allikas ütleb "enne", ära kirjuta `../1543`: see loetakse perioodina.

## Vahemik valiku sees: `..`, mitte `/`

Nurksulgude (valiku) sees märgitakse vahemik **kahe punktiga**:

- ✅ `[1300..1500,1720..1809]`
- ❌ `[1300/1500,1720/1809]`: pole kehtiv EDTF ega kuvata korrektselt

Lühikesed vahemikud (kuni 5 aastat) kuvatakse aastate kaupa:
`[1670..1672]` → "üks järgmistest: 1670, 1671, 1672".

## Erisused EDTF standardist

Need kujud **ei ole standardne EDTF**, kuid DL-i rakendus toetab neid teadlikult.
Välised EDTF tööriistad ei pruugi neid aktsepteerida.

| Kuju | Näide | Kuvatakse |
|------|-------|-----------|
| Valik vahemiku otspunktina | `[1453,1465]/[1462,1473]` | üks järgmistest: 1453, 1465 – üks järgmistest: 1462, 1473 |
| Valik ühe otspunktina | `1541-07-23/[1556,1557]` | 23. juuli 1541 – üks järgmistest: 1556, 1557 |
| Lühendatud avatud vahemik | `/1277`, `1277/` | kuni 1277, alates 1277 |

## Mitme allika lahknevad kuupäevad

Kui allikad annavad erinevad kuupäevad, mida üks EDTF väärtus ei kirjelda
(nt "pärast 1562 või 1587"), sisesta kuupäevaväljale turvaline lihtsustus
(`1562/..`) ja algne sõnastus märkuste väljale (`internal_notes`). Vt #232.
