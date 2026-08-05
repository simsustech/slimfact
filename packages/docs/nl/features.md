# Functionaliteiten

SlimFact is het facturatieplatform dat het zware werk doet. Van het maken van een factuur tot betaald krijgen — alles wat je nodig hebt in één overzichtelijk pakket.

---

## 📄 Facturen, rekeningen & bonnen

Eén systeem, drie documenttypes. Maak professionele facturen, verstuur rekeningen en geef bonnen uit. Elk document vloeit natuurlijk over in het volgende:

- **Rekening** → betaald → **Bon** → **Factuur** — converteren naarmate de transactie vordert
- Onwijzigbaar na openen — je administratie blijft schoon en controleerbaar
- Btw-tarieven per regel, inclusief of exclusief — elk btw-scenario mogelijk
- Decimale aantallen en per-mille-ondersteuning — precisie waar het telt
- Vervaldata, betalingstermijnen en automatische statusopvolging

![Factuurbeheer](/screenshots/admin-invoices.png)

---

## 💳 Online betalingen

Je klanten betalen online. Jij krijgt bericht. Geen handmatige verwerking.

- **iDEAL / Wero** — de populairste Nederlandse online betaalmethode
- **Creditcards** — Visa, Mastercard en meer
- **Multi-PSP-routering** — routeer iDEAL via Mollie en creditcards via Stripe, of mix en match
- **Aanbetalingen** — vereis een gedeeltelijke betaling vooraf
- **Contant & bankoverschrijving** — voor offline betalingen met transactieregistratie
- **Automatische statussynchronisatie** — webhooks werken de factuurstatus bij zodra de betaling is voltooid
- **Terugbetalingen** — verwerk terugbetalingen rechtstreeks via je PSP

![Rekeningbeheer](/screenshots/admin-bills.png)

---

## 🔄 Abonnementsfacturatie

Stel het in en vergeet het. Terugkerende facturen draaien op cron-schema's terwijl jij je op je bedrijf richt.

- Cron-gebaseerde planning — elke maandag, eerste van de maand, per kwartaal, wat je maar nodig hebt
- Start- en einddatums — abonnementen die voor een vaste periode lopen
- Actief/inactief-schakelaar — pauzeer abonnementen zonder ze te verwijderen
- Elk abonnement genereert automatisch correct genummerde facturen

![Abonnementsbeheer](/screenshots/admin-subscriptions.png)

---

## 📊 Admin-dashboard

Een realtime overzicht van je factuurbedrijf, direct na het inloggen.

- Omzetkaarten en een omzetgrafiek met inzoomen per bucket en granulariteit van dag/week/maand/kwartaal
- Statusoverzicht en verouderingsbuckets voor vervallen facturen — herinnering nodig, herinnering verstuurd, tweede herinnering, aanmaning
- Verwachte inkomsten en een uitsplitsing per betaalmethode per periode
- Recente activiteitenfeed van facturen, rekeningen, betalingen, herinneringen en aanmaningen

## 👤 Klantenportaal

Je klanten krijgen hun eigen omgeving. Ze zien wat ze verschuldigd zijn, wanneer het vervalt en kunnen meteen betalen.

- Persoonlijk dashboard met alle facturen, rekeningen en bonnen
- Online betalen direct vanaf de factuurpagina
- Real-time statusupdates — in behandeling, open, betaald
- Geen account nodig — deel de factuurlink en ze zijn er

![Klantrekeningen](/screenshots/customer-bills.png)

---

## 🏢 Bedrijven & klanten

Beheer meerdere bedrijven vanuit één account. Elk bedrijf krijgt zijn eigen identiteit.

- **Bedrijfsprofielen** — naam, adres, bankgegevens, btw-nummer, KvK-nummer, logo
- **Bedrijfsspecifieke voorvoegsels** — houd factuurnummers per bedrijf gescheiden
- **Klantgegevens** — contactpersoon, adres, e-mail, btw-nummer
- **Nummerprefixsjablonen** — `{jaar}-{nr}`, `FACT-{bedrijf}-{nr}`, wat je maar wilt
- **Configureerbare startnummers** — ga verder waar je oude systeem ophield

![Bedrijfsbeheer](/screenshots/admin-companies.png)

![Klantbeheer](/screenshots/admin-clients.png)

---

## 📧 E-mail & communicatie

Verstuur facturen per e-mail. Weet wanneer ze gelezen worden.

- **Aanpasbare e-mailsjablonen** — Handlebars-aangedreven met varianten per taal
- **Open-tracking** — een URL-queryparameter vertelt je wanneer een klant de factuurlink opent vanuit de e-mail
- **E-mailinstellingen per bedrijf** — verschillende afzenderadressen en BCC per bedrijf
- **Verstuur, verstuur opnieuw, beantwoord** — volledige e-mailworkflow vanuit het factuurdetail

---
## 🎨 Typst-factuurrendering

SlimFact gebruikt [Typst](https://typst.app) — een moderne, open-source zetsysteem — om facturen te renderen. In tegenstelling tot traditionele HTML-naar-PDF-converters produceert Typst heldere, perfect uitgelijnde lay-outs met professionele typografie.

- **SVG-preview** — facturen worden direct in de browser weergegeven als schaalbaar SVG, zonder layoutverschuivingen
- **PDF-export** — download met één klik als printklare PDF met ingesloten lettertypen
- **Meertalige sjablonen** — Engelse, Nederlandse en Duitse factuursjablonen met gelokaliseerde veldnamen, datumnotaties en betalingsinstructies
- **Aanpasbare sjablonen** — factuurlay-outs zijn geschreven in Typst, een schone, leesbare opmaaktaal. Je kunt je eigen sjablonen toevoegen voor aangepaste huisstijlen, andere documenttypes of branchespecifieke lay-outs
- **Bedrijfshuisstijl** — logo, adres, bankgegevens en KvK-/btw-nummers inline weergegeven
- **Flexibele lay-outs** — A4- en US Letter-paginaformaten, inclusieve/exclusieve btw-weergave, automatische meerregelige omschrijvingen
- **Documenttype-bewust** — toont automatisch de juiste titel (Factuur, Rekening, Bon of Concept) op basis van de documentstatus
- **EPC QR-codes** — scanbare betaal-QR-codes direct in de PDF ingesloten voor directe bankoverschrijvingen

![Typst factuurpreview](/screenshots/invoice-public.png)

[Download voorbeeld factuur-PDF](/screenshots/invoice.pdf)

## 📦 Exports & formaten

- **PDF** — download van de publieke factuurpagina
- **Digiboox** — formaat voor Digiboox-integratie (Instellingen → Exports)
- **EPC QR-codes** — scanbare betaalcodes op elke PDF-factuur
- **UBL XML** — automatisch bijgevoegd bij verzonden OPEN/PAID factuur-e-mails

![Exportopties](/screenshots/admin-exports.png)

---

## 🔌 Headless API

SlimFact is API-first. Elke functie die beschikbaar is in de UI is ook beschikbaar via de API.

- **tRPC** — type-veilige RPC met automatische client-generatie
- **OIDC-authenticatie** — werkt headless met elke OIDC-provider
- **Webhook-callbacks** — word op de hoogte gebracht van betalingsgebeurtenissen
- Bouw aangepaste frontends, integreer met je ERP of automatiseer je volledige facturatieworkflow

---

## 🔐 Authenticatie & beveiliging

Jouw data blijft van jou. Authenticatie wordt afgehandeld door je bestaande identity provider.

- **OpenID Connect** — federatieve SSO met elke OIDC-provider
- **Meerdere rollen** — beheerder, kassamedewerker en klant
- **Geen aparte gebruikersdatabase** — je IdP is de bron van waarheid

---

## 📱 Technisch

- **Volledig responsive** — werkt op desktop, tablet en mobiel

![SlimFact op mobiel](/screenshots/homepage-mobile.png)

- **Database-ondersteund** — alle facturen opgeslagen in PostgreSQL voor geavanceerde query's
- **On-the-fly PDF-generatie** — geen verouderde bestanden, altijd het nieuwste sjabloon
- **Meertalig** — Engels, Nederlands en Duits in de interface
- **Self-hosted** — draait op je eigen infrastructuur met Docker Compose
- **~160 req/s** — verwerkt meer dan 14 miljoen API-aanroepen per dag op bescheiden hardware

![SlimFact homepage](/screenshots/homepage.png)
