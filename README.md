# Devotion Tracker — Google Apps Script Web App



## Karakteristik

- **Setup Wizard** — chwazi ki spreadsheet/ID/Tab ou vle konekte
- **Column Mapping** — di ki kolòn nan yon sheet matche ak ki kolòn nan yon lòt
- **Dashboard** — grafik (bar, pie, doughnut) ak stats
- **Tracker** — ajoute/edit/efase devotion (append sèlman, pa janm override)
- **Phone Lookup** — chèche moun pa nimewo atravè tout koneksyon
- **Koulè** — gradyan mauve, blan, bleu, rouj, light green

## Setup Wizard

Lè w konekte la pwemye fwa, w ap wè yon wizard 4 etap:

1. **Devotion Sheet** — antre ID spreadsheet la, chwazi tab la
2. **Members Sheet** — antre ID spreadsheet kote done manm yo ye
3. **Column Mapping** — chwazi ki kolòn matche (eg: FULL NAME → FULL NAME, PHONE → PHONE)
4. **Review & Save** — verifye epi anrejistre

## Column Mapping

Ou ka kreye mappings ant nenpòt kolòn nan nenpòt spreadsheet.

**Egzanp**: Si nan sheet Devotion ou gen kolòn "MEMBERS PHONE" men nan sheet Members ou gen kolòn "PHONE", mapping lan pral:
```
Devotionals: MEMBERS PHONE → Members: PHONE
```

Lè w ap chèche moun, mapping yo aplike otomatikman pou anrichi done yo.

## Koneksyon Dinamis

Ou pa limite a 2 sheet. Ou ka ajoute plizyè koneksyon nan **Settings > Koneksyon**:
- **Devotion** — sheet prensipal la
- **Lookup** — sheet pou chèche moun
- **Reference** — done siplemantè

## Arsitektur

```
Code.gs → Config Manager (PropertiesService)
        → Sheet Repository (dinamik selon config)
        → Mapping Engine (aplike mappings sou done yo)
        → Auth (token-based)

Index.html → Login → Setup Wizard → Dashboard
                                      → Tracker
                                      → Members
                                      → Connections
                                      → Mappings
                                      → Settings
```

## Deplwayman

1. script.google.com → Nouvo pwojè
2. Kopi `Code.gs` nan tab Code
3. Kreye tab `Index.html` epi kopi la
4. Modifye `CONFIG.AUTH.USERS` ak imèl/pin ou
5. Deploy → Web app
