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
| Kuni / alates (periood, roll või amet) | `../1277` / `1985/..` | kuni 1277 / alates 1985 |
| Enne / pärast (ajahetk, sünd, surm, ost) | `[..1543]` / `[1511..]` | enne 1543 / pärast 1511 |
| Üks mitmest aastast | `[1556,1557]` | üks järgmistest: 1556, 1557 |
| Üks mitmest vahemikust | `[1300..1500,1720..1809]` | üks järgmistest: 1300 – 1500, 1720 – 1809 |

## Enne / pärast vs kuni / alates

Avatud otsaga kuupäeval on kaks eri tähendust. Kumba kasutada, sõltub sellest, **mille** kuupäev see on.

| | Tähendus | Kirjuta | Kuvatakse |
|---|---|---|---|
| **Enne** | üks ajahetk jääb antud aasta ette (või sellele) | `[..1448]` | enne 1448 |
| **Pärast** | üks ajahetk jääb antud aasta taha (või sellele) | `[1262..]` | pärast 1262 |
| **Kuni** | periood, mis lõpeb antud ajal | `../1525` | kuni 1525 |
| **Alates** | periood, mis algab antud ajal | `1478/..` | alates 1478 |

### 1. Sünd ja surm: alati enne / pärast

Sünnil ja surmal on üks ajahetk. Kui täpset kuupäeva ei tea, ütleb allikas "enne X" või
"pärast X". Sünni- ja surmaväljale (`birth_string`, `death_string`) kirjuta alati **hulk**.

| Allikas ütleb | Sisesta | Kuvatakse |
|---|---|---|
| sündinud enne 1448 | `[..1448]` | enne 1448 |
| surnud pärast 1262 | `[1262..]` | pärast 1262 |
| surnud enne 13. märtsi 1473 | `[..1473-03-13]` | enne 13. märts 1473 |
| surnud pärast juunit 1409 | `[1409-06..]` | pärast juuni 1409 |
| surnud enne 1480, ebakindel | `[..1480?]` | enne arvatavasti 1480 |
| surnud pärast u 1500, ebakindel | `[1500%..]` | pärast arvatavasti umbes 1500 |

❌ Ära kirjuta `../1448` või `1262/..`: need loetakse perioodiks ("kuni", "alates") ja
sünni/surma kohta oleks see vale.

### 2. Rollid, ametid ja muud sündmused: kuni / alates

Rolli või ameti algus või lõpp on teada, nt "oli Vogt kuni 1322" või "oli toomhärra alates 1478".
See on periood, mitte ajahetk. Sündmuste väljale (`people_events.date_string`) kirjuta
**avatud vahemik**.

| Allikas ütleb | Sisesta | Kuvatakse |
|---|---|---|
| toomhärra, tegutses kuni 1525 | `../1525` | kuni 1525 |
| kantor, viimati mainitud 1472 | `../1472` | kuni 1472 |
| sekretär alates 1477 | `1477/..` | alates 1477 |
| varahoidja kuni 11. jaanuarini 1411 | `../1411-01-07` | kuni 07. jaanuar 1411 |
| üliõpilane 1403–1415 | `1403/1415` | 1403 – 1415 |

❌ Ära kirjuta `[..1525]` sündmuse kuupäevaks: see tähendaks üht ajahetke "enne 1525",
mitte rolli perioodi.

### 3. Tehingud ja omand (kinnisvara, pärusraamat): alati enne / pärast

Ostu, müügi või omandamise kuupäev on üks ajahetk, nagu sünd ja surm.

| Allikas ütleb | Sisesta | Kuvatakse |
|---|---|---|
| omandatud enne 1543 | `[..1543]` | enne 1543 |
| omandatud pärast 1511 | `[1511..]` | pärast 1511 |

### Kiire valik

- Üks sündmus ajas (sünd, surm, ost, müük): **enne / pärast**, kirjuta `[..X]` / `[X..]`.
- Midagi, mis kestab (roll, amet, ametiaeg, omand): **kuni / alates**, kirjuta `../X` / `X/..`.
- Kui sul on algus **ja** lõpp: tavaline vahemik `1403/1415`.

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
