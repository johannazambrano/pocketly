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
import math
import re
import sys
import uuid
from datetime import date, datetime

import openpyxl

# --- colori: stessa logica di src/utils/colors.ts ------------------------------------------------------
# Tinte con la stessa luminosita' e intensita' (OKLCH L 0,66, C 0,13), senza rossi, senza il verde delle
# azioni e il blu del risultato. Ogni voce prende la tinta piu' lontana da quelle gia' date; "Altro" e' grigio.
PALETTE = [
    '#cf7a3d', '#01a0d1', '#b377c5', '#7ea040', '#b18e15', '#8687df',
    '#06a7a6', '#c38323', '#9a9725', '#9f7ed6', '#c371b0', '#04a4ba',
]
OTHER_COLOR = '#8c939b'
OTHER_NAMES = {'altro', 'altri', 'other', 'others'}
L_, C_ = 0.66, 0.13
HUE_RANGES = [(45, 140), (190, 245), (280, 345)]
HUE_STEPS = [a + i * 5 for a, b in HUE_RANGES for i in range((b - a) // 5 + 1)]


def _to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _from_linear(c):
    v = min(1.0, max(0.0, c))
    return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055


def hex_to_oklch(hex_color: str):
    h = hex_color.lstrip('#')
    if not re.fullmatch(r'[0-9a-fA-F]{6}', h):
        return None
    r, g, b = (_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    ll = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    return ll, math.hypot(a, bb), (math.degrees(math.atan2(bb, a)) + 360) % 360


def _oklch_to_linear(l, c, h):
    a, b = c * math.cos(math.radians(h)), c * math.sin(math.radians(h))
    l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
    return [
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ]


def oklch_to_hex(l, c, h) -> str:
    chroma = c
    rgb = _oklch_to_linear(l, chroma, h)
    while chroma > 0 and any(v < -1e-4 or v > 1 + 1e-4 for v in rgb):
        chroma = max(0.0, chroma - 0.002)
        rgb = _oklch_to_linear(l, chroma, h)
    return '#' + ''.join(f'{round(_from_linear(v) * 255):02x}' for v in rgb)


def _hue_distance(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def _spread(hue, used):
    return min(_hue_distance(hue, u) for u in used) if used else 360


def pick_unique_color(existing: list[str]) -> str:
    taken = {c.lower() for c in existing}
    used = [o[2] for o in map(hex_to_oklch, existing) if o and o[1] > 0.04]
    free = [c for c in PALETTE if c not in taken]
    if free:
        best = free[0]
        for c in free[1:]:
            if _spread(hex_to_oklch(c)[2], used) > _spread(hex_to_oklch(best)[2], used) + 0.5:
                best = c
        return best
    best_hue = HUE_STEPS[0]
    for h in HUE_STEPS[1:]:
        if _spread(h, used) > _spread(best_hue, used):
            best_hue = h
    return oklch_to_hex(L_, C_, best_hue)


def harmonized_colors(names: list[str], already_given: list[str]) -> list[str]:
    given = list(already_given)
    out = []
    for name in names:
        color = OTHER_COLOR if name.strip().lower() in OTHER_NAMES else pick_unique_color(given)
        given.append(color)
        out.append(color)
    return out


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

    def __init__(self, prefix: str = 'cat'):
        self.items: list[dict] = []
        self.by_key: dict[str, dict] = {}
        self.prefix = prefix

    def add(self, name: str) -> str:
        key = name.casefold()
        if key not in self.by_key:
            # Il colore si sceglie alla fine, quando ci sono tutte le voci (colorize).
            tag = {'id': stable_id(f'{self.prefix}:{key}'), 'name': name, 'color': ''}
            self.items.append(tag)
            self.by_key[key] = tag
        return self.by_key[key]['id']


def colorize(lists: list['Tags']) -> None:
    """Categorie, poi metodi di pagamento, poi tag: colori in equilibrio e mai uguali tra elenchi."""
    given: list[str] = []
    for lst in lists:
        colors = harmonized_colors([t['name'] for t in lst.items], given)
        for t, c in zip(lst.items, colors):
            t['color'] = c
        given.extend(colors)


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
    categories, payments, tags = Tags('cat'), Tags('pm'), Tags('tag')

    settings = sheet(wb, 'settings')
    if settings:
        for row in settings.iter_rows(min_row=4, max_row=19, values_only=True):
            if clean(row[0]):
                categories.add(clean(row[0]))
            if len(row) > 3 and clean(row[3]):
                payments.add(clean(row[3]))
        # Tag: colonna N, solo se in N3 c'e' l'intestazione "TAG" (o "Tags"); tutta la colonna dalla riga 4,
        # saltando le celle vuote.
        if re.fullmatch(r'tags?', clean(settings.cell(row=3, column=14).value), re.IGNORECASE):
            for row in settings.iter_rows(min_row=4, min_col=14, max_col=14, values_only=True):
                if clean(row[0]):
                    tags.add(clean(row[0]))

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

    colorize([categories, payments, tags])

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
