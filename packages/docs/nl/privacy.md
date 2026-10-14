# Privacybeleid

_Laatst bijgewerkt: 30 augustus 2026_

Dit privacybeleid legt uit hoe **simsustech** ("wij", "we", "ons") persoonsgegevens verwerkt in verband met **SlimFact** — beschikbaar als beheerde **Cloud**-dienst op [slimfact.app](https://www.slimfact.app) en [demo.slimfact.app](https://demo.slimfact.app), en als **Self-Hosted** open-source editie — en deze documentatiesite.

Verwerkingsverantwoordelijke: **simsustech** — contact: [info@simsus.tech](mailto:info@simsus.tech), website: [simsus.tech](https://www.simsus.tech).

KvK: 83537813

Vragen over privacy of het uitoefenen van je rechten? Mail naar [info@simsus.tech](mailto:info@simsus.tech).

---

## 1. Toepassingsgebied

- **Cloud** — Wanneer je SlimFact Cloud gebruikt zijn wij de verwerkingsverantwoordelijke (en voor factuur-/klantgegevens die je invoert handelen wij als verwerker namens jou). Dit beleid is dan volledig van toepassing.
- **Self-Hosted** — Wanneer je SlimFact zelf host op je eigen infrastructuur, wordt er geen applicatiedata naar ons verzonden. Jij bent dan de verwerkingsverantwoordelijke voor alle data in je instantie. Dit beleid geldt dan alleen voor je gebruik van onze website/docs/demo en supportkanalen.
- **Documentatiesite** — De docs op `slimfact.app` zijn statisch en verzamelen standaard geen analytics.

---

## 2. Gegevens die we verwerken

### 2.1 Account & authenticatie

- Wat: e-mailadres, naam (indien opgegeven), wachtwoord-hash of OIDC subject/issuer, bedrijfsnaam, gebruikersvoorkeuren.
- Doel: accounts aanbieden, authenticatie via wachtwoord of OpenID Connect, multi-company toegang beheren.
- Grondslag: uitvoering van de overeenkomst (Art. 6(1)(b) AVG), gerechtvaardigd belang bij veilige authenticatie (Art. 6(1)(f)).

### 2.2 Facturatie-inhoud die je aanmaakt

- Wat: bedrijfsgegevens, klantgegevens (namen, e-mails, adressen, btw-nummers), facturen, rekeningen, bonnen, betaalreferenties die je invoert.
- Doel: de facturatiedienst leveren die je aanvraagt.
- Grondslag: overeenkomst (Art. 6(1)(b)), wettelijke bewaarplicht voor bedrijfsadministratie waar van toepassing (Art. 6(1)(c)). Jij bent verantwoordelijk dat je een rechtmatige grondslag hebt om gegevens van je klanten met ons te delen.

### 2.3 Betalingen (online betalingen)

- Wat: betaalstatus, bedrag, valuta, PSP-referenties, e-mail van betaler waar nodig voor iDEAL/creditcard via **Mollie** of **Stripe**. Wij slaan geen volledige kaartnummers op.
- Doel: online betalingen verwerken en afletteren, refunds/chargebacks afhandelen waar van toepassing.
- Grondslag: overeenkomst (Art. 6(1)(b)). Betaalgegevens worden door Mollie/Stripe als (gezamenlijk) verwerkingsverantwoordelijke/verwerker verwerkt onder hun eigen beleid.

### 2.4 E-mailbezorging & factuurlink-tracking

- Wat: ontvangeradres, onderwerp, bezorgstatus, bounce/klacht-signalen, en — wanneer de ontvanger op de factuurlink in de e-mail klikt — een `?eventType=emailOpened` event dat registreert dat de factuur via de e-maillink is geopend.
- Doel: factuurmails bezorgen en bezorgstatus tonen en vastleggen of de factuurlink is geklikt.
- Grondslag: overeenkomst (Art. 6(1)(b)) en gerechtvaardigd belang bij het bevestigen van bezorging/weergave van facturen (Art. 6(1)(f)). Dit is alleen link-klik tracking — geen onzichtbare pixel, geen automatische open-detectie zonder klik.

### 2.5 Support & contact

- Wat: berichten die je stuurt naar [info@simsus.tech](mailto:info@simsus.tech), demo-aanvragen, GitHub-issues die je opent.
- Doel: vragen beantwoorden, support bieden.
- Grondslag: (pre-)contract (Art. 6(1)(b)), gerechtvaardigd belang (Art. 6(1)(f)).

### 2.6 Logs & beveiliging

- Wat: IP-adres, user-agent, tijdstempels, foutlogs, rate-limit tellers.
- Doel: beveiliging, misbruikpreventie, debugging, beschikbaarheid waarborgen.
- Grondslag: gerechtvaardigd belang (Art. 6(1)(f)), wettelijke plicht waar logging vereist is.
- Bewaartermijn: kort (doorgaans 30 dagen) tenzij langer nodig voor incidentonderzoek.

---

## 3. Cookies

SlimFact gebruikt alleen **strikt noodzakelijke** cookies:

- Sessie-/authenticatie-cookies (inclusief OIDC state/nonce en CSRF-tokens) — nodig om ingelogd te blijven.
- Voorkeurscookies (bijv. taal/locale) — functioneel.

Er zijn **geen analytics- of advertentiecookies** op de Cloud-app of docs-site standaard. Factuurmails bevatten een normale link om de factuur te bekijken (`https://…/invoice/{uuid}?eventType=emailOpened`). Alleen als de ontvanger op die link klikt, wordt een `emailOpened` event geregistreerd — er wordt geen onzichtbare trackingpixel gebruikt.

Als we ooit analytics toevoegen (bijv. Plausible), werken we dit hoofdstuk bij en vragen we waar nodig toestemming.

---

## 4. Subverwerkers (Cloud)

Voor Cloud doen we een beroep op de volgende categorieën verwerkers, die alleen in onze opdracht verwerken:

| Categorie                | Aanbieder                                          | Locatie                  | Doel                                               |
| ------------------------ | -------------------------------------------------- | ------------------------ | -------------------------------------------------- |
| Hosting & infrastructuur | EU-hostingprovider (bijv. Hetzner / EU-datacenter) | EU/EER                   | Applicatie- & databasehosting, dagelijkse back-ups |
| Betaaldienstverleners    | **Mollie B.V.** en **Stripe, Inc.**                | EU / VS (met waarborgen) | Online betalingen (iDEAL, kaarten)                 |
| E-mailbezorging          | Transactionele e-mailprovider (SMTP)               | EU/EER                   | Bezorgen van factuur- & systeemmails               |

We kunnen aanbieders vervangen door gelijkwaardige EU/EER-alternatieven — wijzigingen worden hier bijgewerkt. Doorgiften van Stripe naar de VS zijn gedekt door Standard Contractual Clauses.

Self-Hosted instanties hebben geen subverwerkers via ons.

---

## 5. Hostingslocatie & internationale doorgiften

Cloud-data wordt gehost in de **EU/EER**. We geven persoonsgegevens niet doelbewust door buiten de EER, behalve waar een betaalprovider (Stripe) of jij (bijv. doorsturen van een factuur naar een ontvanger buiten de EER) dit vereist. Waar doorgifte plaatsvindt, baseren we ons op adequaatheidsbesluiten of Standard Contractual Clauses.

---

## 6. Bewaartermijnen

- Account- & bedrijfsgegevens: zolang je account actief is, plus 30 dagen na verwijdering voor herstel, tenzij de wet langere bewaring eist.
- Facturen/rekeningen/bonnen & gerelateerde klantgegevens: bewaard zolang je account actief is. Na accountverwijdering binnen 30 dagen verwijderd, tenzij fiscale bewaarplicht langer vereist (doorgaans 7–10 jaar voor facturen — we informeren je waar van toepassing en minimaliseren wat bewaard blijft).
- E-maillogs: 90 dagen.
- Beveiligingslogs: 30 dagen.
- Supportcorrespondentie: 2 jaar.

Je kunt je data (inclusief facturen als PDF/UBL/CSV) op elk moment vóór verwijdering exporteren en om wissing verzoeken, met inachtneming van wettelijke bewaarplichten.

---

## 7. Je rechten (AVG)

Waar EU/EER-privacywet geldt, heb je het recht op:

- **Inzage** in je persoonsgegevens
- **Rectificatie** van onjuiste gegevens
- **Wissing** ("recht om vergeten te worden"), met inachtneming van wettelijke bewaarplicht
- **Beperking** van de verwerking
- **Dataportabiliteit** (export in gestructureerde formaten)
- **Bezwaar** tegen verwerking op basis van gerechtvaardigd belang
- **Intrekken van toestemming** waar verwerking op toestemming berust
- **Klacht indienen** bij je toezichthouder (in Nederland de _Autoriteit Persoonsgegevens_, of je lokale DPA).

Oefen rechten uit via [info@simsus.tech](mailto:info@simsus.tech). We reageren binnen één maand.

Als je als SlimFact-klant gegevens van je eigen eindklanten verwerkt, ben jij de verwerkingsverantwoordelijke voor die klantgegevens — zorg dat je verzoeken van je klanten afhandelt en verzoeken die onze hulp vereisen aan ons doorstuurt.

---

## 8. Beveiliging

We nemen passende technische en organisatorische maatregelen: TLS/SSL voor alle verbindingen, versleutelde sessiecookies, dagelijks versleutelde back-ups, least-privilege databasetoegang, beveiligingspatches en automatische updates voor Cloud, en OIDC-SSO waar ingeschakeld. Geen enkel systeem is 100% veilig — gebruik sterke wachtwoorden en ga veilig om met OIDC-inloggegevens.

---

## 9. Wijzigingen in dit beleid

We kunnen dit beleid bijwerken bij wijzigingen in dienst of wetgeving. Materiële wijzigingen kondigen we aan via de docs-site en, voor Cloud-klanten, per e-mail. De datum "Laatst bijgewerkt" bovenaan geeft de huidige versie aan.

---

## 10. Contact

Vragen over dit beleid of onze privacypraktijken:

- **E-mail:** [info@simsus.tech](mailto:info@simsus.tech)
- **Website:** [simsus.tech](https://www.simsus.tech)
- **GitHub:** [simsustech/slimfact](https://github.com/simsustech/slimfact)

Voor self-hosted installaties is je eigen organisatie het privacy-aanspreekpunt voor eindklantgegevens — dit beleid vervangt niet je eigen privacyverklaring aan je klanten.
