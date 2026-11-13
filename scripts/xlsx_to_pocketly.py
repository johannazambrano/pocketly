#!/usr/bin/env python3
"""Converte il foglio Excel "Expense Tracker" nel formato di backup Pocketly (schema v2).

Uso:
    python scripts/xlsx_to_pocketly.py INPUT.xlsx OUTPUT.json [--default-day N]

Richiede openpyxl (pip install openpyxl).

Mappatura:
  - "One-time"  -> oneTimeExpenses. Se manca la colonna Data si usa il primo del mese
                   indicato in "Mese" (es. "October 2026" -> 2026-10-01).
  - "Income"    -> incomes (stessa regola per la data).
  - "Recurring" -> recurringExpenses. Data di inizio = "Data Inizio" se presente, altrimenti
                   il primo mese elencato in "Mese". Se l'ultimo mese elencato non e' dicembre
                   la ricorrenza termina alla fine di quel mese (endDate).
  - Categorie, metodi di pagamento e tag: dal foglio Settings piu' quelli usati nei dati.
  - Non supportati da Pocketly e quindi ignorati: Fonte, Prelievo su, frequenza Weekly.
"""
import argparse
import calendar
import io
import json
import re
import sys
import uuid
from datetime import date, datetime

import openpyxl

# Stessa palette di src/utils/colors.ts (leggibile con testo bianco).
PALETTE = [
    '#f59e0b', '#3b82f6', '#64748b', '#ec4899', '#10b981', '#8b5cf6', '#f97316', '#06b6d4',
    '#6366f1', '#0284c7', '#ef4444', '#84cc16', '#14b8a6', '#a855f7', '#e11d48', '#0d9488',
]
FREQUENCIES = {'monthly': 'monthly', 'quarterly': 'quarterly', 'semi-annual': 'semiannual', 'annual': 'annual'}

POCKETLY_NAMESPACE = uuid.UUID('7b38d648-52e6-4277-bf30-4e4b52df33ce')


def stable_id(seed: str) -> str:
    """Genera un UUID v5 deterministico per garantire la stabilità degli ID tra import multipli."""
    return str(uuid.uuid5(POCKETLY_NAMESPACE, seed))


def cents(v) -> int | None:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return round(v * 100)


def clean(v) -> str:
    return str(v).strip() if v is not None else ''


def parse_tag_names(value) -> list[str]:
    return [part.strip() for part in re.split(r'[,;]', clean(value)) if part.strip()]


def parse_months(text, warn_fn) -> list[tuple[int, int]]:
    """'January 2026, March 2026' -> [(2026, 0), (2026, 2)] ordinati."""
    out = []
    for part in clean(text).split(','):
        part = part.strip()
        if not part:
            continue
        try:
            d = datetime.strptime(part, '%B %Y')
        except ValueError:
            warn_fn(f'mese non riconosciuto: {part!r}')
            continue
        out.append((d.year, d.month - 1))
    return sorted(set(out))


def iso(y: int, m: int, d: int) -> str:
    return f'{y:04d}-{m + 1:02d}-{d:02d}'


def to_iso(v) -> str | None:
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, str):
        s = v.strip()
        if len(s) == 10 and s[4] == '-' and s[7] == '-':
            try:
                date.fromisoformat(s)
                return s
            except ValueError:
                pass
    return None


class Tags:
    """Elenco di categorie / metodi di pagamento con ricerca senza distinguere maiuscole
    e ID stabili per evitare duplicazioni."""

    def __init__(self, prefix: str = 'cat', offset: int = 0):
        self.items: list[dict] = []
        self.by_key: dict[str, dict] = {}
        self.prefix = prefix
        self.offset = offset

    def add(self, name: str) -> str:
        key = name.casefold()
        if key not in self.by_key:
            color = PALETTE[(len(self.items) + self.offset) % len(PALETTE)]
            tag = {'id': stable_id(f'{self.prefix}:{key}'), 'name': name, 'color': color}
            self.items.append(tag)
            self.by_key[key] = tag
        return self.by_key[key]['id']


def sheet(wb, fragment: str):
    for ws in wb.worksheets:
        if fragment.lower() in ws.title.lower():
            return ws
    return None


def rows_with_header(ws, header_row: int = 2):
    """Restituisce (numero_riga, {intestazione: valore}) per le righe sotto l'intestazione,
    fermandosi alla riga TOTALE."""
    headers = [clean(c) for c in next(ws.iter_rows(min_row=header_row, max_row=header_row, values_only=True))]
    for n, row in enumerate(ws.iter_rows(min_row=header_row + 1, values_only=True), header_row + 1):
        if clean(row[0]).upper() == 'TOTALE':
            break
        yield n, {h: v for h, v in zip(headers, row) if h}


def convert_xlsx(source, default_day: int = 1) -> tuple[dict, dict, list[str]]:
    """Converte un file Excel o stream binario nel dizionario dati compatibile con Pocketly schema v2.
    
    Restituisce: (data, stats, warnings)
    """
    warnings: list[str] = []

    def warn(msg: str) -> None:
        warnings.append(msg)

    if isinstance(source, (bytes, bytearray)):
        source = io.BytesIO(source)

    wb = openpyxl.load_workbook(source, data_only=True)
    categories, payments, tags = Tags('cat', 0), Tags('pm', 8), Tags('tag', 4)

    settings = sheet(wb, 'settings')
    if settings:
        for row in settings.iter_rows(min_row=4, max_row=19, values_only=True):
            if clean(row[0]):
                categories.add(clean(row[0]))
            if len(row) > 3 and clean(row[3]):
                payments.add(clean(row[3]))
            if len(row) > 13 and clean(row[13]):
                tags.add(clean(row[13]))
        for row in settings.iter_rows(min_row=20, values_only=True):
            tag = clean(row[13]) if len(row) > 13 else ''
            if not tag:
                break
            tags.add(tag)

    def day_of(y: int, m: int) -> int:
        return min(default_day, calendar.monthrange(y, m + 1)[1])

    def resolve_date(row: dict, what: str, n: int) -> str | None:
        d = to_iso(row.get('Data'))
        if d:
            return d
        months = parse_months(row.get('Mese'), warn)
        if not months:
            warn(f'{what} riga {n}: manca la data e il mese, voce saltata')
            return None
        y, m = months[0]
        warn(f'{what} riga {n} ({clean(row.get("Nome"))}): senza data, uso {iso(y, m, day_of(y, m))}')
        return iso(y, m, day_of(y, m))

    one_time, recurring, incomes = [], [], []

    ws = sheet(wb, 'one-time')
    if ws:
        ot_seen: dict[tuple, int] = {}
        for n, r in rows_with_header(ws):
            amount = cents(r.get('Importo (€)'))
            if not clean(r.get('Nome')) or amount is None:
                continue
            d = resolve_date(r, 'One-time', n)
            if not d:
                continue
            cat_name = clean(r.get('Categoria')) or 'Other'
            pm_name = clean(r.get('Metodo Pagamento')) or 'Other'
            sig = (d, clean(r['Nome']).casefold(), amount)
            ot_seen[sig] = ot_seen.get(sig, 0) + 1
            item_id = stable_id(f'ot:{d}:{clean(r["Nome"]).casefold()}:{amount}:{ot_seen[sig]}')

            tag_ids = []
            for tag_name in parse_tag_names(r.get('Tag')):
                tag_id = tags.add(tag_name)
                if tag_id not in tag_ids:
                    tag_ids.append(tag_id)

            one_time.append({
                'id': item_id,
                'name': clean(r['Nome']),
                'amount': amount,
                'date': d,
                'categoryId': categories.add(cat_name),
                'paymentMethodId': payments.add(pm_name),
                'notes': clean(r.get('Note')),
                'tagIds': tag_ids,
            })

    ws = sheet(wb, 'income')
    if ws:
        in_seen: dict[tuple, int] = {}
        for n, r in rows_with_header(ws):
            amount = cents(r.get('Importo (€)'))
            if not clean(r.get('Nome')) or amount is None:
                continue
            d = resolve_date(r, 'Income', n)
            if not d:
                continue
            cat_name = clean(r.get('Categoria')) or 'Other'
            pm_name = clean(r.get('Prelievo su')) or 'Other'
            sig = (d, clean(r['Nome']).casefold(), amount)
            in_seen[sig] = in_seen.get(sig, 0) + 1
            item_id = stable_id(f'in:{d}:{clean(r["Nome"]).casefold()}:{amount}:{in_seen[sig]}')

            incomes.append({
                'id': item_id,
                'name': clean(r['Nome']),
                'amount': amount,
                'date': d,
                'categoryId': categories.add(cat_name),
                'paymentMethodId': payments.add(pm_name),
            })

    ws = sheet(wb, 'recurring')
    if ws:
        rec_seen: dict[tuple, int] = {}
        for n, r in rows_with_header(ws):
            amount = cents(r.get('Importo (€)'))
            name = clean(r.get('Nome'))
            if not name or amount is None:
                if name or amount is not None:
                    warn(f'Recurring riga {n}: nome o importo mancante, voce saltata')
                continue
            freq = FREQUENCIES.get(clean(r.get('Frequenza')).casefold())
            if not freq:
                warn(f'Recurring riga {n} ({name}): frequenza {clean(r.get("Frequenza"))!r} non supportata, voce saltata')
                continue
            months = parse_months(r.get('Mese'), warn)
            explicit_start = to_iso(r.get('Data Inizio'))
            if explicit_start:
                start, end = explicit_start, None
            elif months:
                (y0, m0), (y1, m1) = months[0], months[-1]
                start = iso(y0, m0, day_of(y0, m0))
                # Mesi elencati fino a dicembre = ricorrenza ancora aperta; altrimenti finisce a fine mese.
                end = None if m1 == 11 or freq == 'annual' else iso(y1, m1, calendar.monthrange(y1, m1 + 1)[1])
            else:
                warn(f'Recurring riga {n} ({name}): manca Data Inizio e Mese, voce saltata')
                continue
            if explicit_start and len(months) > 1 and freq == 'annual':
                warn(f'Recurring riga {n} ({name}): annuale con {len(months)} mesi elencati, uso solo la Data Inizio')

            cat_name = clean(r.get('Categoria')) or 'Other'
            pm_name = clean(r.get('Metodo Pagamento')) or 'Other'
            sig = (name.casefold(), amount, freq, start)
            rec_seen[sig] = rec_seen.get(sig, 0) + 1
            item_id = stable_id(f'rec:{name.casefold()}:{amount}:{freq}:{start}:{rec_seen[sig]}')

            recurring.append({
                'id': item_id,
                'name': name,
                'amount': amount,
                'frequency': freq,
                'startDate': start,
                'endDate': end,
                'categoryId': categories.add(cat_name),
                'paymentMethodId': payments.add(pm_name),
            })

    ws = sheet(wb, 'prestiti')
    if ws:
        filled = [row for row in ws.iter_rows(min_row=4, values_only=True) if any(c is not None for c in row)]
        if filled:
            warn(f'Prestiti: {len(filled)} righe presenti ma il foglio non ha una struttura standard, non convertite')

    data = {
        'schemaVersion': 2,
        'categories': categories.items,
        'paymentMethods': payments.items,
        'tags': tags.items,
        'oneTimeExpenses': one_time,
        'recurringExpenses': recurring,
        'incomes': incomes,
        'loans': [],
        'simulations': [],
        'forecast': {
            'estimateIncome': False,
            'incomeCategoryIds': [],
        },
        'budget': {
            'limits': {},
        },
    }

    stats = {
        'categories': len(data['categories']),
        'paymentMethods': len(data['paymentMethods']),
        'tags': len(data['tags']),
        'oneTimeExpenses': len(data['oneTimeExpenses']),
        'recurringExpenses': len(data['recurringExpenses']),
        'incomes': len(data['incomes']),
    }

    return data, stats, warnings


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input')
    ap.add_argument('output')
    ap.add_argument('--default-day', type=int, default=1,
                    help='giorno del mese da usare quando nel file c\'e\' solo il mese (default 1)')
    args = ap.parse_args()

    data, stats, warnings = convert_xlsx(args.input, default_day=args.default_day)

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'Scritto {args.output}')
    for key, count in stats.items():
        print(f'  {key}: {count}')
    for w in warnings:
        print('  ! ' + w, file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
