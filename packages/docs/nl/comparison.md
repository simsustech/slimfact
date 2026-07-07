# Waarom SlimFact

Standaard facturatieprogramma's werken voor gewone situaties. Maar als je bedrijf specifieke wensen heeft — aangepaste workflows, unieke documentformaten, specialistische integraties — loop je meestal vast.

SlimFact is open-source en API-first. Niet alleen configureerbaar: **aanpasbaar.** Jij bezit de code, de data en de hele pijplijn. Als het niet precies doet wat je nodig hebt, kun je het aanpassen.

---

## Wat Je Kunt Aanpassen

| Onderdeel | Wat is mogelijk |
|---|---|
| **Factuur-PDF-sjablonen** | Schrijf je eigen Typst-sjabloon — volledige controle over layout, lettertypen, kleuren en inhoud. Of maak meerdere sjablonen voor verschillende documenttypes |
| **E-mailsjablonen** | Handlebars met varianten per taal — elke structuur, elke inhoud, elke taal |
| **API-gedrag** | Pas servercode aan voor aangepaste bedrijfslogica — de volledige broncode is van jou |
| **Betalingsroutering** | Routeer iDEAL via één PSP, creditcards via een andere. Voeg je eigen PSP-handler toe indien nodig |
| **Factuurnummering** | Elk formaat met dynamische segmenten — `{jaar}-{nr}`, `FACT-{bedrijf}-{maand}-{nr}`, wat past bij jouw systeem |
| **Auth-flows** | Elke OIDC-provider, elk rollenmodel — gebruik je eigen identiteit en permissiestructuur |
| **Database** | Directe SQL-toegang tot PostgreSQL — query, rapporteer en breid uit verder dan de API |
| **Frontend** | Bouw je eigen UI bovenop de API, of pas de bestaande Vue 3-frontend aan |
| **Meertaligheid** | EN / NL / DE inbegrepen — meer talen kunnen op verzoek worden toegevoegd |

---

## Open-Source — Pas de Volledige Stack Aan

SlimFact is open-source onder de ELv2-licentie. Je kunt de identieke applicatie gratis self-hosten — geen functiebeperkingen, geen proefperiode.

- **Volledige broncoded toegang** — inspecteer, wijzig en breid elke laag uit: databaseschema, rendering-pipeline, authenticatie, betalingsroutering
- **Gratis self-host** — dezelfde code die de cloud draait, draait op jouw infrastructuur
- **Jouw data, jouw database** — alles staat in PostgreSQL. Geen propriëtaire opslag, geen export-hobbels
- **Diepgaand aanpassen** — wijzig API-gedrag, voeg aangepaste bedrijfslogica toe, pas PDF-sjablonen aan, sluit andere PSP's aan
- **Geen vendor lock-in** — omdat jij de code bezit. Weggaan, forken, uitbreiden — altijd jouw keuze

---

## Headless API — Facturatie Ingebouwd in Jouw Software

SlimFact is API-first gebouwd. Elke functie die beschikbaar is in de web-UI is ook beschikbaar via een type-veilige tRPC-API — geen aparte codepaden, geen functie-ontbrekingen, geen rate limits bij self-host.

**Gebruik SlimFact als je facturatie-backend.** Jouw applicatie roept de API aan om facturen te maken, betalingen te verwerken, PDF's te genereren en status te synchroniseren — zonder dat je gebruikers ooit de SlimFact-UI zien.

- **Integreer in SaaS-platformen** — voeg facturatie toe aan je bestaande applicatie zonder het zelf te bouwen
- **White-label frontend** — bouw je eigen klantenportaal, POS-terminal of mobiele app bovenop de API
- **Automatiseer workflows** — facturen genereren, verzenden en innen via de API
- **ERP-integratie** — synchroniseer facturen, betalingen en klanten met je bestaande systemen
- **Abonnementsbeheer** — beheer terugkerende facturatie volledig via de API
- **Webhook-meldingen** — ontvang real-time notificaties bij betalingen en statuswijzigingen

### Waarom type-veiligheid belangrijk is

SlimFact gebruikt tRPC — niet REST. Je IDE autocompleet elk endpoint, valideert request- en response-types tijdens het compileren en vangt integratiefouten af voordat ze in productie komen. Geen API-documentatie bestuderen, geen handmatige request-builders, geen "waarom komt dit veld niet door" om 2 uur 's nachts.

### Headless authenticatie

Sluit elke OpenID Connect-provider aan voor authenticatie. Jouw identity provider regelt de auth — SlimFact valideert alleen de tokens. Dit werkt ook headless: machine-to-machine flows, service accounts en API-only deployments.

---

## Geen Functieblokkering

Cloud: **€15/maand, alle functies.** Self-host: **€0, alle functies.**

Dezelfde code, elke installatie. Geen niveaus, geen opwaardeervoorstellen, geen verrassingen.

---

## Professionele Facturen met Typst

SlimFact gebruikt [Typst](https://typst.app) — een moderne open-source zetsysteem — om facturen te renderen. Dezelfde technologie die wordt gebruikt voor academische papers en professionele publicaties.

- **SVG-preview** — direct in de browser gerenderd, geen layoutverschuivingen
- **Ingesloten lettertypen** — de PDF ziet er op elk apparaat en elke printer hetzelfde uit
- **EPC QR-codes** — scanbare betaalcodes in elke factuur
- **Meertalige sjablonen** — Engels, Nederlands en Duits met correcte locale opmaak
- **Aangepaste sjablonen** — gebruik je eigen Typst-sjabloon voor unieke huisstijl

---

## Multi-Company Standaard

Beheer onbeperkt veel bedrijven vanuit één account. Elk krijgt zijn eigen:

- Huisstijl en logo
- Bankgegevens en betalingsprofielen
- Factuurnummeringssjablonen
- E-mailinstellingen
- Mollie API-sleutel (per bedrijf, voor multi-PSP)
- Stripe API-sleutel (per bedrijf, voor multi-PSP)

---

## Jouw PSP, Jouw Geld

- Sluit **je eigen** Mollie- of Stripe-account aan — SlimFact gaat nooit met je geld om
- **Geen transactiekosten** van SlimFact — je betaalt alleen wat je PSP rekent
- **Routering per methode** — iDEAL via Mollie, creditcards via Stripe, of andersom
- **Aanbetalingen** — vereis een gedeeltelijke betaling vooraf

---

## Vergelijking in één Oogopslag

| | SlimFact | Invoice Ninja | FreshBooks | Xero |
|---|---|---|---|---|
| **Cloud prijs** | €15/mnd | $12–$50/mnd | $19–$50/mnd | €24–€54/mnd |
| **Open-source** | ✅ ELv2 | ⚠️ Aparte build | ❌ | ❌ |
| **Gratis self-host** | ✅ Volledige functies | ✅ Self-host optie | ❌ | ❌ |
| **Volledige broncode** | ✅ | ❌ | ❌ | ❌ |
| **Aangepaste PDF-sjablonen** | ✅ Volledig Typst | Beperkte presets | Beperkte presets | Beperkte presets |
| **Aanpasbaar API-gedrag** | ✅ Servercode aanpassen | ❌ | ❌ | ❌ |
| **Headless API** | ✅ tRPC, type-veilig | ✅ REST | ✅ REST | ✅ REST |
| **API rate limits** | Geen (self-host) | Ja | Ja | Ja |
| **OIDC-auth** | ✅ | ❌ | ❌ | ❌ |
| **PDF-engine** | Typst | HTML-naar-PDF | HTML-naar-PDF | HTML-naar-PDF |
| **Multi-company** | ✅ Onbeperkt | Beperkt | ❌ | Beperkt |
| **Multi-PSP-routering** | ✅ | ❌ | ❌ | ❌ |
| **UBL / Peppol export** | ✅ | ❌ | ❌ | ❌ |
| **Functieblokkering** | Geen | 4 niveaus | 3 niveaus | 3 niveaus |
| **Abonnementsfacturatie** | ✅ Cron-gebaseerd | ✅ | ✅ | ✅ |
| **Klantenportaal** | ✅ | ✅ | ✅ | ✅ |
| **Meertalige UI** | EN / NL / DE (+ meer op verzoek) | 20+ talen | 7 talen | 10+ talen |

Voor een gedetailleerde functielijst, zie de [Prijzen-pagina](/nl/pricing).

---

## Conclusie

**Je hebt specifieke facturatiebehoeften waar standaardprogramma's niet aan voldoen** — SlimFact past zich aan jou aan. Open-source code, volledig aanpasbare sjablonen en een type-veilige API voor diepgaande integratie.

**Je bouwt software en hebt een facturatie-engine nodig** — bouw SlimFact headless in. API-first, open-source, geen rate limits.

**Je wilt eenvoud** — €15/maand, beheerde hosting, alle functies, geen niveaus.

**Je wilt volledige controle** — self-host gratis, eigenaar van de code, eigenaar van je data.

[Bekijk de Demo](https://demo.slimfact.app) — of [neem contact op](/nl/contact) om je wensen te bespreken.
