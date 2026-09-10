# Beheerdershandleiding

Deze handleiding behandelt alles wat beheerders kunnen doen — van het aanmaken van je eerste factuur tot het configureren van het hele systeem.

---

## Navigatie

Als beheerder geeft je zijbalk toegang tot:

- **Dashboard** — omzet, actiepunten en recente activiteit in één oogopslag
- **Facturen** — facturen aanmaken en beheren
- **Rekeningen** — rekeningen aanmaken en beheren
- **Bonnen** — bonnen bekijken en beheren
- **Abonnementen** — terugkerende facturatie instellen
- **Klanten** — je klantgegevens beheren
- **Instellingen** — bedrijven, nummerprefixen, exports, accounts

---

## Dashboard

Het dashboard is je overzicht in één oogopslag: omzet, openstaand werk en recente activiteit op één plek. Open het vanuit de zijbalk (Dashboard).
![Admin dashboard](/screenshots/admin-dashboard.png)

### Omzet

- **Omzetkaarten** tonen het gefactureerde, betaalde en openstaande totaal voor de geselecteerde periode
- **Omzetgrafiek** zet betaalde omzet uit in de tijd — kies een preset (vandaag, week, maand, kwartaal, jaar) of een eigen datumbereik
- **Klik op een bucket** in de grafiek om in te zoomen op die periode; klik opnieuw om uit te zoomen
- De grafiek past de granulariteit aan het bereik aan: dagen, weken, maanden of kwartalen

### Actiepunten

- **Statusoverzicht** telt facturen per status (concept, open, betaald, geannuleerd, rekeningen, bonnen)
- **Debiteuren** toont klanten met vervallen facturen en hoeveel ze verschuldigd zijn
- **Vervallen** groepeert onbetaalde facturen per verouderingsbucket: herinnering nodig, herinnering verstuurd, tweede herinnering, aanmaning

### Verwachte inkomsten

- Verwachte kasinstroom van open facturen die nog niet vervallen zijn
- Schakel tussen **Verwacht** en **Vervallen** om te zien wat er aankomt versus wat te laat is

### Betaalmethoden

- Hoeveel er per methode is betaald (iDEAL, creditcard, contant, bankoverschrijving) in de geselecteerde periode

### Recente activiteit

- Een chronologische feed van wat er is gebeurd: verstuurde facturen, aangemaakte rekeningen, ontvangen betalingen, verstuurde herinneringen en aanmaningen

---

## Aan de slag

Voordat je je eerste factuur maakt, stel je de basis in:

### 1. Een bedrijf aanmaken

1. Ga naar **Instellingen → Bedrijven**
2. Klik op de **+** knop
3. Vul je bedrijfsgegevens in:
   - **Naam**, adres, postcode, plaats, land
   - **Contactpersoon**, telefoon, website
   - **KvK-nummer**, **IBAN**, **BIC**, **btw-nummer**
   - **Prefix** — een korte code die dit bedrijf identificeert (bijv. "ACME")
   - **E-mail** — het afzenderadres voor facturen
4. Klik op **Verzenden**

![Bedrijfsbeheer](/screenshots/admin-companies.png)

### 2. Een klant aanmaken

1. Ga naar **Klanten**
2. Klik op de **+** knop
3. Vul in:
   - **Bedrijfsnaam**, **contactpersoon**
   - **Adres**, postcode, plaats, land
   - **E-mail** — waar facturen naartoe worden gestuurd
   - Btw-nummer en KvK-nummer (optioneel)
4. Klik op **Verzenden**

![Klantbeheer](/screenshots/admin-clients.png)

### 3. Nummerprefixen instellen

Nummerprefixen bepalen hoe je factuurnummers eruitzien.

1. Ga naar **Instellingen → Nummerprefixen**
2. Klik op **+** om een nieuw sjabloon toe te voegen
3. Stel het sjabloon in, bijvoorbeeld: `{jaar}-{nr}` of `F{jaar}{maand}-{nr}`
4. Stel het startnummer in — de eerste factuur begint vanaf dit nummer
5. Klik op **Verzenden**

![Nummerprefixconfiguratie](/screenshots/admin-numberprefixes.png)

---

## Facturen aanmaken

### Facturen

1. Ga naar **Facturen**
2. Klik op de **+** knop
3. Selecteer het **Bedrijf** en de **Klant**
4. Kies een **Nummerprefix**
5. Voeg **Regels** toe — klik op het regelitem om omschrijving, eenheidsprijs, aantal en btw-tarief in te stellen
6. Voeg optioneel kortingen of toeslagen toe
7. Klik op **Verzenden**
8. De factuur wordt aangemaakt in **Concept**-status

![Factuurbeheer](/screenshots/admin-invoices.png)

### Een factuur versturen

1. Vouw de factuur uit door op het toggle-icoon te klikken
2. Klik op het **Meer**-menu (⋮)
3. Klik op **Versturen**
4. Voeg een onderwerp en bericht toe (optioneel)
5. Klik op **Versturen** — de factuurstatus verandert naar **Open** en de klant krijgt een e-mail

### Factuuracties

Zodra een factuur is uitgevouwen, geeft het Meer-menu je:

| Actie                  | Wanneer beschikbaar                                                  |
| ---------------------- | -------------------------------------------------------------------- |
| **Bewerken**           | Concept, Rekening                                                    |
| **Versturen**          | Concept, Rekening — e-mailt de factuur naar de klant                 |
| **Openen**             | Alle statussen behalve Geannuleerd — opent de publieke factuurpagina |
| **Annuleren**          | Concept, Rekening (als er geen bedrag is betaald)                    |
| **Betaling toevoegen** | Open, Rekening (als er een bedrag verschuldigd is)                   |
| **Bon versturen**      | Rekening (als volledig betaald) — converteert naar een bon           |
| **Herinnering sturen** | Open (na vervaldatum, met 7 dagen wachttijd)                         |
| **Aanmaning sturen**   | Open (na 2 herinneringen, met 7 dagen wachttijd)                     |
| Actie                  | Wanneer beschikbaar                                                  |
| -------                | -------------------                                                  |
| **Bewerken**           | Concept, Rekening                                                    |
| **Versturen**          | Concept, Rekening — e-mailt de factuur naar de klant                 |
| **Openen**             | Alle statussen behalve Geannuleerd — opent de publieke factuurpagina |
| **Annuleren**          | Concept, Rekening (als er geen bedrag is betaald)                    |
| **Betaling toevoegen** | Open, Rekening (als er een bedrag verschuldigd is)                   |
| **Bon versturen**      | Rekening (als volledig betaald) — converteert naar een bon           |
| **Herinnering sturen** | Open (na vervaldatum, met 7 dagen wachttijd)                         |
| **Aanmaning sturen**   | Open (na 2 herinneringen, met 7 dagen wachttijd)                     |

### Factuurstatusverloop

```
CONCEPT → OPEN → BETAALD / GEANNULEERD
```

- **Concept** — nog in bewerking, nog niet verstuurd
- **Open** — verstuurd naar klant, wachtend op betaling (onwijzigbaar)
- **Betaald** — betaling ontvangen
- **Geannuleerd** — niet langer geldig

### Herinneringen & Aanmaningen

Wanneer een factuur achterstallig is, kun je betalingsherinneringen versturen:

- **Herinnering sturen** — de eerste herinnering kan verstuurd worden zodra de betalingstermijn verstreken is. Een tweede herinnering is 7 dagen later beschikbaar. Na twee herinneringen word je gevraagd een aanmaning te sturen.
- **Aanmaning sturen** — een formele betalingsvordering, beschikbaar 7 dagen na de tweede herinnering.

De factuur toont wanneer herinneringen zijn verstuurd. E-mailsjablonen voor beide zijn aanpasbaar onder Instellingen.

---

## Rekeningen

Rekeningen werken hetzelfde als facturen maar beginnen met een andere bedoeling. Maak een rekening aan wanneer je om betaling wilt vragen. Zodra deze betaald is, zet je deze om naar een bon — betalingsbewijs.

1. Ga naar **Rekeningen**
2. Klik op **+** en vul de gegevens in (zelfde als facturen)
3. Klik op **Verzenden**

![Rekeningbeheer](/screenshots/admin-bills.png)

Zodra een rekening betaald is, kan deze worden omgezet naar een bon. Een bon kan vervolgens worden omgezet naar een factuur.

### Een rekening versturen

1. Vouw de rekening uit en klik op het **Meer**-menu (⋮)
2. Klik op **Versturen**
3. Voeg een onderwerp en bericht toe
4. Klik op **Versturen** — de klant ontvangt een e-mail met het betalingsverzoek

### Een rekening omzetten

1. Zodra de rekening betaald is, vouw deze uit en open het **Meer**-menu
2. Klik op **Omzetten naar bon**
3. De rekening wordt een bon — je kunt deze nu verder omzetten naar een factuur

## Bonnen

Bonnen zijn betalingsbewijzen. Ze worden aangemaakt door een betaalde rekening om te zetten.

- Bekijk bonnen onder **Bonnen** in de zijbalk
- Bonnen worden aangemaakt vanuit betaalde rekeningen. Ze kunnen worden omgezet naar betaalde facturen

---

## Abonnementen

Stel terugkerende facturen in die automatisch worden gegenereerd.

### Een abonnement aanmaken

1. Ga naar **Abonnementen**
2. Klik op **+**
3. Selecteer het **Bedrijf**, de **Klant** en het **Nummerprefix**
4. Kies het **Type** — factuur of rekening
5. Voeg regelitems toe — zelfde als facturen
6. Stel het **Cron-schema** in:
   - `0 0 1 * *` — eerste van elke maand
   - `0 0 * * 1` — elke maandag
   - `0 0 1 */3 *` — elke 3 maanden
7. Stel **Startdatum** en optioneel **Einddatum** in
8. Klik op **Verzenden**

![Abonnementsbeheer](/screenshots/admin-subscriptions.png)

### Abonnementen beheren

- **Actief/inactief schakelen** — pauzeren zonder te verwijderen
- **Bewerken** — schema, regels of details wijzigen
- **Verwijderen** — permanent verwijderen

---

## Online betalingen

SlimFact ondersteunt meerdere payment service providers.

### Mollie configureren

Stel `MOLLIE_API_KEY` in en SlimFact regelt de rest. Voor meerdere bedrijven voeg je bedrijfsspecifieke sleutels toe met `MOLLIE_API_KEY_<PREFIX>`.

### Stripe configureren

Stel `STRIPE_API_KEY` in. Zelfde patroon voor meerdere bedrijven: `STRIPE_API_KEY_<PREFIX>`.

### Routering van betaalmethoden

Bepaal welke PSP welke betaalmethode afhandelt:

| Env-variabele                | Opties               |
| ---------------------------- | -------------------- |
| `WERO_PAYMENT_HANDLER`       | `mollie` of `stripe` |
| `CREDITCARD_PAYMENT_HANDLER` | `mollie` of `stripe` |

Geen van beide heeft een standaardwaarde. Laat je er een weg, dan wordt die
betaalmethode niet aangeboden — de betaalknop verdwijnt, in plaats van terug te
vallen op een provider.

### Contant & bankoverschrijving

Dit zijn offline betaalmethoden. Registreer contante betalingen of overschrijvingen handmatig vanuit het Meer-menu van de factuur.

### Terugbetalingen

1. Open een betaalde factuur
2. Selecteer in het Meer-menu de terugbetalingsoptie
3. De terugbetaling wordt verwerkt via de oorspronkelijke PSP

---

## Exports

> Wanneer je een factuur per e-mail verstuurt, wordt de PDF automatisch bijgevoegd. Als de factuur OPEN of PAID is, wordt ook een UBL XML bijgevoegd.

### Exportformaten

Ga naar **Instellingen → Exports** voor toegang tot:

- **Digiboox** — exporteer facturen in Digiboox-formaat. Meer formaten op verzoek beschikbaar.

## Bankimport

Banktransacties komen uit open-banking.io via de banking-api proxy, die de
volledige historie bewaart. Ze verschijnen op twee plekken:

- **Instellingen → Bank** (`/admin/settings/banking`) — verbindingsstatus, de
  koppeling van rekeningen aan bedrijven, en **Sync nu** om te verversen.
  Waarschuwt wanneer een bankmachtiging opnieuw moet worden ingesteld.
- **Betalingen → Suggesties** (`/admin/payments`) — binnenkomende crediteringen
  die een beslissing nodig hebben. Elke rij toont de meest waarschijnlijke
  factuur en een score: **Koppelen** hangt de creditering aan één of meer
  facturen, **Negeren** verbergt hem voor dat bedrijf.

Een exacte match (bedrag, referentie, datumbereik en valuta) wordt automatisch
toegepast als een **bankgekoppelde betaling**, dus die komt nooit in de wachtrij.
Is een factuur al handmatig per bankoverschrijving betaald voor het exacte
bedrag, dan **adopteert** koppelen die betaling in plaats van een tweede te
registreren.

> **Gepland: transactieoverzicht.** Een pagina met elke banktransactie bestaat nog
> niet. Die toont elke creditering naast de betalingen en facturen waaraan hij is
> gekoppeld, inclusief de PSP-settlements (Mollie, Stripe) achter uitbetalingen in
> bulk. Die uitbetalingen worden al op de achtergrond ingelezen en gematcht, maar
> niets in de UI toont ze vandaag — één grote creditering van een betaalprovider
> kan dus onverklaard lijken.
>
> **Zelf hosten?** Installatie staat in de README van het package: [Banking-API](https://github.com/simsustech/slimfact/blob/main/packages/banking-api/README.md) beschrijft de architectuur, omgevingsvariabelen, referenties en API-sleutelconfiguratie.
>
> Bekende beperking: als een strikte match eerst automatisch is toegepast en
> je later handmatig een bankoverschrijving registreert voor dezelfde factuur,
> kunnen er twee betaalde betalingen bestaan.

---

## E-mailtracking

Wanneer je een factuur per e-mail verstuurt, wordt er een `?eventType=emailOpened` queryparameter aan de factuurlink toegevoegd. Wanneer de klant op de link klikt om de factuur te bekijken, registreert SlimFact de gebeurtenis.

---

## Tips

- **Stel eerst je bedrijf in** — een factuur heeft een afzender nodig
- **Gebruik nummerprefixen consistent** — kies een formaat en blijf erbij
- **Controleer concepten voor verzending** — facturen worden onwijzigbaar na openen
- **Controleer abonnementsschema's** — zorg dat cron-expressies correct zijn
- **Houd e-mailopens in de gaten** — weet wanneer klanten je facturen bekijken
