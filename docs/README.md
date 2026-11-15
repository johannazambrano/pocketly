---
source-files: []
verified: 2026-11-10
---

# Indice della Documentazione di Pocketly

Benvenuto nella documentazione di **Pocketly**. Questo indice è strutturato per permettere a umani e agenti IA di raggiungere qualsiasi informazione tecnica o concettuale in al massimo **due click**.

---

## 🧭 Percorsi Rapidi: "Cosa vuoi fare?"

| Esigenza / Domanda | Documento Consigliato |
|---|---|
| **Sono un agente IA** e devo svolgere un task | [AGENTS.md](../AGENTS.md) |
| Voglio una **panoramica ad alto livello** dell'app e dei suoi scopi | [Panoramica Generale](panoramica.md) |
| Cerco un file o voglio sapere **chi fa cosa** nel codice | [Mappa del Codice](riferimento/mappa-codice.md) |
| Devo capire come sono strutturati i **tipi e i dati finanziari** | [Modello Dati](riferimento/modello-dati.md) |
| Devo verificare o modificare formule matematiche e **logiche di calcolo** | [Logica di Dominio](riferimento/domain.md) |
| Voglio capire come funzionano **componenti Vue e schermate** | [Componenti e Viste](riferimento/componenti-e-viste.md) |
| Devo comprendere l'architettura **frontend** (Pinia, Vue Router, PWA) | [Architettura Frontend](architettura/frontend.md) |
| Devo capire come funziona la **sync cifrata** e il merge a 3 vie | [Dati e Sincronizzazione](architettura/dati-e-sincronizzazione.md) |
| Devo comprendere il **server Python** e le notifiche Web Push | [Architettura Backend](architettura/backend.md) |
| Voglio **aggiungere una nuova schermata/vista** | [Guida: Aggiungere una Vista](guide/aggiungere-una-vista.md) |
| Voglio **aggiungere un nuovo campo** a una transazione o modello | [Guida: Aggiungere un Campo ai Dati](guide/aggiungere-un-campo-ai-dati.md) |
| Voglio eseguire i **test** o preparare una nuova build | [Guida: Test e Release](guide/test-e-release.md) |
| Voglio verificare i **limiti o bug noti** dell'applicazione | [Stato e Difetti Noti](known-issues.md) |
| Voglio configurare il **deploy su Proxmox LXC con Nginx** | [Deploy Proxmox](architettura/deploy.md) |

---

## 📂 Struttura dell'Albero della Documentazione

```
docs/
├── README.md                          <-- Questo indice
├── panoramica.md                      <-- Visione d'insieme e flussi utente ad alto livello
├── NOTIFICHE.md                       <-- Guida completa notifiche locali e push
├── IMPORTA_DA_EXCEL.md                <-- Istruzioni migrazione dati da fogli Excel
├── known-issues.md                    <-- Registro difetti aperti verificati sul codice
├── architettura/
│   ├── frontend.md                    <-- Strati Vue 3, Pinia, routing, i18n, PWA
│   ├── dati-e-sincronizzazione.md     <-- DataStore, crittografia E2E, 3-way merge
│   ├── backend.md                     <-- Server Python (zero-deps), API REST, VAPID
│   └── deploy.md                      <-- Proxmox LXC, systemd, Nginx, proxy Vite
├── riferimento/
│   ├── mappa-codice.md                <-- Tabella file -> responsabilità -> test
│   ├── modello-dati.md                <-- Tipi TS, centesimi, migrazione schemi
│   ├── domain.md                      <-- Funzioni pure di calcolo contabile
│   └── componenti-e-viste.md          <-- Dettaglio delle 9 viste e 27 componenti
├── guide/
│   ├── aggiungere-una-vista.md        <-- Step-by-step per nuove viste
│   ├── aggiungere-un-campo-ai-dati.md <-- Step-by-step modello + migrazione + merge
│   ├── sync-e-notifiche.md            <-- Setup e collaudo sync e Web Push
│   └── test-e-release.md              <-- Guida esecuzione test e build
└── archivio/
    ├── README.md                      <-- Indice documenti storici archiviati
    ├── PANORAMICA.md                  <-- Vecchia panoramica iniziale
    ├── riepilogo-notifiche.md         <-- Revisione storica notifiche
    └── consistency_analysis_and_remediation_plan.md <-- Piano di analisi precedente
```

---

## 🏷️ Convenzione Front-matter

Tutti i documenti tecnici in `docs/` adottano uno standard front-matter YAML:
```yaml
---
source-files:
  - src/path/al/file.ts
verified: YYYY-MM-DD
---
```
Quando un agente o uno sviluppatore modifica un file del codice sorgente, deve aggiornare i file di documentazione correlati e la data `verified`.
