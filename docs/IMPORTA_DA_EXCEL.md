# Importare in Pocketly i dati dell'Excel "Expense Tracker"

Pocketly non legge direttamente i file Excel. Lo script `scripts/xlsx_to_pocketly.py` converte l'Excel in
un file JSON di backup, che poi si importa dalle Impostazioni dell'app.

```
Excel (.xlsx)  ──►  scripts/xlsx_to_pocketly.py  ──►  pocketly-import.json  ──►  app: Importa backup
```

## 1. Cosa serve

- **Python 3** e la libreria **openpyxl**: `pip install openpyxl`.
- La cartella del progetto (basta il file `scripts/xlsx_to_pocketly.py`).
- Il file Excel, **chiuso** in Excel (se è aperto, Windows può impedirne la lettura).

Lo script legge i **valori** salvati nel file, non le formule. Il file deve quindi essere stato salvato
da Excel almeno una volta dopo l'ultima modifica.

## 2. Convertire

Dalla cartella del progetto (PowerShell o Git Bash):

```
python scripts/xlsx_to_pocketly.py "C:\percorso\Expense_Tracker_2026_v3.xlsx" "C:\percorso\pocketly-import.json"
```

Salva il JSON **fuori dalla cartella del progetto**: contiene i tuoi dati personali e non deve finire
nel repository.

Se nel file c'è solo il mese e non il giorno, lo script usa il giorno 1. Per usare un altro giorno:

```
python scripts/xlsx_to_pocketly.py ... --default-day 30
```

Alla fine lo script stampa quante voci ha scritto per ogni tipo e, se c'è qualcosa da controllare, un
elenco di avvisi che iniziano con `!`. **Leggili sempre**: indicano le voci saltate o interpretate.

## 3. Cosa viene convertito

I fogli `One-time`, `Income` e `Recurring` sono letti per **nome delle colonne**, non per posizione:
aggiungere o spostare colonne non è un problema, rinominare quelle usate sì. Il foglio `Settings` è invece
letto per **posizione**: categorie nella colonna A e metodi di pagamento nella colonna D, dalla riga 4 alla 19.

| Foglio | Diventa | Colonne usate |
|---|---|---|
| `One-time` | Spese una tantum | Nome, Importo (€), Categoria, Data (o Mese), Metodo Pagamento, Note |
| `Income` | Entrate | Nome, Importo (€), Categoria, Data (o Mese), **Prelievo su** (diventa il metodo di pagamento) |
| `Recurring` | Spese ricorrenti | Nome, Importo (€), Categoria, Frequenza, Data Inizio, Mese, Metodo Pagamento |
| `Settings` | Categorie e metodi di pagamento | Colonna A (categorie) e colonna D (metodi di pagamento) |

La lettura di ogni foglio si ferma alla riga `TOTALE`. Le righe senza nome o senza importo sono saltate.

Regole di conversione:

- **Importi:** da euro a centesimi interi (63 € → `6300`).
- **Categorie e metodi di pagamento:** quelli del foglio `Settings` più quelli usati nei dati ma non
  elencati. `casa` e `Casa` sono la stessa categoria. I colori sono quelli dell'app, non i pastello dell'Excel
  (con il testo bianco non sarebbero leggibili).
- **Data mancante:** si usa il primo giorno del mese indicato in `Mese` (es. `October 2026` → `2026-10-01`).
  Se mancano sia la data sia il mese, la voce è saltata e compare un avviso.
- **Ricorrenze, data di inizio:** è `Data Inizio` se presente, altrimenti il primo mese elencato in `Mese`.
- **Ricorrenze, data di fine:** se l'ultimo mese elencato non è dicembre, la ricorrenza finisce alla fine di
  quel mese. Se arriva a dicembre, resta aperta (continua anche negli anni successivi). Quindi una ricorrenza
  mensile con il solo mese di settembre vale una volta sola.
- **Frequenze:** `Monthly`, `Quarterly`, `Semi-annual`, `Annual`.
- **Annuale con più mesi elencati e `Data Inizio`:** conta solo la `Data Inizio` (con avviso).

**Non vengono convertiti** (Pocketly non li prevede): i Tag, la colonna Fonte, la frequenza `Weekly`, le note
delle ricorrenze, i prestiti e le simulazioni. Il foglio `Prestiti` non ha una struttura standard: se contiene
righe, lo script lo segnala e le salta. Prestiti e simulazioni si inseriscono poi a mano nell'app.

## 4. Importare nell'app

> **L'import sostituisce tutti i dati presenti nell'app**, non li unisce. Se nell'app hai già inserito
> qualcosa, prima usa *Esporta backup*.

1. Apri **Impostazioni → Backup e ripristino**.
2. Tocca **Importa backup** e scegli `pocketly-import.json`.
3. Conferma il messaggio "I dati attuali verranno sostituiti da quelli del file".
4. Compare "Dati importati con successo". Se invece dice "Il file non è un backup valido", il file non
   è in un formato riconosciuto: ripeti la conversione e controlla che il JSON non sia stato modificato.

I dati restano **nel browser di quel dispositivo**: l'import va fatto su ogni dispositivo che vuoi usare.

### Su iPhone

- Porta il file sull'iPhone (AirDrop, iCloud Drive o un'email a te stessa) e salvalo nell'app *File*.
- L'app aggiunta alla schermata Home e Safari hanno **archivi dati separati**. Installa prima l'app, aprila
  dall'icona e fai l'import da lì, altrimenti i dati importati in Safari non compaiono nell'app installata.

## 5. Controllare il risultato

Dopo l'import confronta con l'Excel:

- **Numero di voci:** spese una tantum, ricorrenze ed entrate devono corrispondere a quelle convertite
  (le contava lo script alla fine).
- **Totali dei mesi:** possono differire dal foglio `Months` dell'Excel quando questo conta una ricorrenza
  in mesi in cui, per Pocketly, non cade. Succede per esempio con una ricorrenza annuale che nell'Excel ha
  tutti i 12 mesi elencati: Pocketly la conta una sola volta l'anno, dalla `Data Inizio`.
- **Date e fine delle ricorrenze:** se non sono come ti aspetti, correggile dall'app oppure rilancia la
  conversione con `--default-day` o correggendo l'Excel.

Rilanciare conversione e import è sicuro: l'import sostituisce di nuovo tutto con il nuovo file.

## 6. Se qualcosa non va

| Sintomo | Causa probabile |
|---|---|
| `ModuleNotFoundError: No module named 'openpyxl'` | Manca la libreria: `pip install openpyxl`. |
| `PermissionError` leggendo il file | L'Excel è aperto: chiudilo. |
| Zero voci convertite | I fogli o le colonne hanno un nome diverso da quelli della tabella del punto 3. |
| Una voce manca dopo l'import | Era senza importo, o senza data e senza mese: guarda gli avvisi `!` della conversione. |
| Importi sbagliati di un fattore 100 | Il JSON è stato scritto a mano con euro invece che centesimi. Gli importi del backup sono centesimi. |

## Scrivere o correggere il JSON a mano

Il formato del backup è descritto nel file di esempio `pocketly-modello-dati.json` nella radice del
progetto. Le regole principali: importi in centesimi interi, date `YYYY-MM-DD`, categorie e metodi di
pagamento collegati per `id`, mesi delle simulazioni da `0` (gennaio) a `11` (dicembre).
L'app scarta le voci malformate invece di bloccare l'import.
