import { describe, expect, it } from 'vitest'
import { decryptBackup, encryptWithKey, WrongPasswordError, type EncryptedBackup } from '@/services/backupCrypto'
import { NewerFormatError, parseBackup } from '@/services/migration'
import { CURRENT_SCHEMA_VERSION, type FinanceData, type OneTimeExpense } from '@/types/models'
import type { PullResult, PushResult, SyncApi } from './api'
import { prepareConnection, SyncConflictError, syncOnce, useDeviceData, useServerData, type SyncContext } from './engine'

const PASSWORD = 'password-di-prova'

/** Server finto con lo stesso comportamento di server/main.py. */
class FakeServer {
  version = 0
  payload: EncryptedBackup | null = null
  /** Eseguito subito prima di rispondere a un push: serve a simulare un altro dispositivo che scrive. */
  beforePush: (() => Promise<void>) | null = null

  api(): SyncApi {
    return {
      pull: async (known): Promise<PullResult> =>
        known !== null && known === this.version ? { changed: false } : { changed: true, version: this.version, payload: this.payload },
      push: async (base, payload): Promise<PushResult> => {
        const hook = this.beforePush
        this.beforePush = null
        if (hook) await hook()
        if (base !== this.version) return { saved: false, version: this.version }
        this.version++
        this.payload = payload
        return { saved: true, version: this.version }
      },
    }
  }
}

function emptyData(): FinanceData {
  return {
    schemaVersion: 3,
    categories: [{ id: 'cat', name: 'Cibo', color: '#f59e0b' }],
    paymentMethods: [{ id: 'pm', name: 'Carta', color: '#64748b' }],
    tags: [],
    oneTimeExpenses: [],
    recurringExpenses: [],
    incomes: [],
    loans: [],
    simulations: [],
    forecast: { estimateIncome: true, incomeCategoryIds: [] },
    budget: { limits: {} },
    savingsGoals: [],
    savingsMovements: [],
    quickExpenses: [],
  }
}

const coffee = (id: string): OneTimeExpense => ({
  id,
  name: 'Caffè',
  amount: 120,
  date: '2026-11-05',
  categoryId: 'cat',
  paymentMethodId: 'pm',
  notes: '',
  tagIds: [],
})

/** Un dispositivo: i suoi dati e il suo stato di sincronizzazione. */
class Device {
  data: FinanceData
  ctx!: Omit<SyncContext, 'getLocal' | 'setLocal'>

  constructor(
    private readonly server: FakeServer,
    data = emptyData(),
  ) {
    this.data = data
  }

  async connect(choice: 'server' | 'device' = 'server') {
    const api = this.server.api()
    const res = await prepareConnection(api, PASSWORD, this.data)
    let state
    if (res.kind === 'empty' || (res.kind === 'choose' && choice === 'device')) state = await useDeviceData(api, res, this.data)
    else {
      state = useServerData(res)
      this.data = structuredClone(res.remote)
    }
    this.ctx = { api, key: res.key, state }
    return res.kind
  }

  async sync() {
    this.ctx.state = await syncOnce({ ...this.ctx, getLocal: () => this.data, setLocal: (d) => (this.data = d) })
  }
}

describe('collegamento', () => {
  it('con il server vuoto carica i dati del dispositivo, cifrati come un backup protetto', async () => {
    const server = new FakeServer()
    const a = new Device(server, { ...emptyData(), oneTimeExpenses: [coffee('c1')] })
    expect(await a.connect()).toBe('empty')
    expect(server.version).toBe(1)
    expect(JSON.stringify(server.payload)).not.toContain('Caffè')
    // La versione sul server si apre con "Importa backup" e la password.
    expect(JSON.parse(await decryptBackup(server.payload!, PASSWORD)).oneTimeExpenses).toHaveLength(1)
  })

  it('un dispositivo senza dati prende quelli del server senza chiedere', async () => {
    const server = new FakeServer()
    await new Device(server, { ...emptyData(), oneTimeExpenses: [coffee('c1')] }).connect()
    const b = new Device(server)
    expect(await b.connect()).toBe('server')
    expect(b.data.oneTimeExpenses).toEqual([coffee('c1')])
  })

  it('con dati da tutte e due le parti chiede di scegliere, e la scelta sovrascrive', async () => {
    const server = new FakeServer()
    await new Device(server, { ...emptyData(), oneTimeExpenses: [coffee('server')] }).connect()

    const keepsServer = new Device(server, { ...emptyData(), oneTimeExpenses: [coffee('locale')] })
    expect(await keepsServer.connect('server')).toBe('choose')
    expect(keepsServer.data.oneTimeExpenses.map((e) => e.id)).toEqual(['server'])

    const keepsDevice = new Device(server, { ...emptyData(), oneTimeExpenses: [coffee('locale')] })
    expect(await keepsDevice.connect('device')).toBe('choose')
    expect(JSON.parse(await decryptBackup(server.payload!, PASSWORD)).oneTimeExpenses.map((e: OneTimeExpense) => e.id)).toEqual(['locale'])
  })

  it('rifiuta una password sbagliata', async () => {
    const server = new FakeServer()
    await new Device(server, { ...emptyData(), oneTimeExpenses: [coffee('c1')] }).connect()
    await expect(prepareConnection(server.api(), 'altra-password', emptyData())).rejects.toBeInstanceOf(WrongPasswordError)
  })

  it('segnala se il server cambia mentre si sceglie', async () => {
    const server = new FakeServer()
    await new Device(server, { ...emptyData(), oneTimeExpenses: [coffee('c1')] }).connect()
    const res = await prepareConnection(server.api(), PASSWORD, { ...emptyData(), oneTimeExpenses: [coffee('c2')] })
    server.version++ // un altro dispositivo ha scritto
    await expect(useDeviceData(server.api(), res, emptyData())).rejects.toBeInstanceOf(SyncConflictError)
  })
})

describe('sincronizzazione', () => {
  async function twoDevices() {
    const server = new FakeServer()
    const a = new Device(server)
    const b = new Device(server)
    await a.connect()
    await b.connect()
    return { server, a, b }
  }

  it('due caffè uguali inseriti su due dispositivi restano due', async () => {
    const { a, b } = await twoDevices()
    a.data.oneTimeExpenses.push(coffee('da-a'))
    b.data.oneTimeExpenses.push(coffee('da-b'))
    await a.sync()
    await b.sync()
    await a.sync()
    expect(a.data.oneTimeExpenses).toHaveLength(2)
    expect(b.data).toEqual(a.data)
  })

  it('una spesa cancellata su un dispositivo sparisce anche dall\'altro e non ricompare', async () => {
    const { a, b } = await twoDevices()
    a.data.oneTimeExpenses.push(coffee('c1'), coffee('c2'))
    await a.sync()
    await b.sync()
    a.data.oneTimeExpenses = a.data.oneTimeExpenses.filter((e) => e.id !== 'c1')
    await a.sync()
    await b.sync()
    await a.sync()
    expect(b.data.oneTimeExpenses.map((e) => e.id)).toEqual(['c2'])
    expect(a.data.oneTimeExpenses.map((e) => e.id)).toEqual(['c2'])
  })

  it('senza novità non invia niente', async () => {
    const { server, a } = await twoDevices()
    const version = server.version
    await a.sync()
    expect(server.version).toBe(version)
  })

  it('chi riceve una modifica non la rimanda indietro al server', async () => {
    const { server, a, b } = await twoDevices()
    a.data.oneTimeExpenses.push(coffee('da-a'))
    await a.sync()
    const version = server.version
    await b.sync()
    await b.sync()
    await a.sync()
    expect(server.version).toBe(version)
    expect(b.data).toEqual(a.data)
  })

  it('se un altro dispositivo scrive nel frattempo riprova e tiene tutte e due le modifiche', async () => {
    const { server, a, b } = await twoDevices()
    a.data.oneTimeExpenses.push(coffee('da-a'))
    server.beforePush = async () => {
      b.data.oneTimeExpenses.push(coffee('da-b'))
      await b.sync()
    }
    await a.sync()
    await b.sync()
    expect(a.data.oneTimeExpenses.map((e) => e.id).sort()).toEqual(['da-a', 'da-b'])
    expect(b.data).toEqual(a.data)
  })

  it('una modifica fatta mentre si aspetta il server non va persa', async () => {
    const { server, a, b } = await twoDevices()
    b.data.oneTimeExpenses.push(coffee('da-b'))
    await b.sync()
    const api = a.ctx.api
    a.ctx.api = {
      ...api,
      pull: async (known) => {
        const res = await api.pull(known)
        a.data.oneTimeExpenses.push(coffee('durante')) // l'utente aggiunge una spesa mentre arriva la risposta
        return res
      },
    }
    await a.sync()
    expect(a.data.oneTimeExpenses.map((e) => e.id).sort()).toEqual(['da-b', 'durante'])
    a.ctx.api = api
    await b.sync()
    expect(b.data.oneTimeExpenses.map((e) => e.id).sort()).toEqual(['da-b', 'durante'])
    expect(server.version).toBeGreaterThan(2)
  })
})

describe('formato dei dati', () => {
  it('con i dati del server in un formato più nuovo si ferma e non invia niente, anche con modifiche da inviare', async () => {
    const server = new FakeServer()
    const a = new Device(server)
    await a.connect()
    // Un dispositivo con un'app più nuova scrive dati in un formato che questa app non conosce.
    const newer = { ...emptyData(), schemaVersion: CURRENT_SCHEMA_VERSION + 1, campoNuovo: [{ id: 'x' }] }
    server.payload = await encryptWithKey(JSON.stringify(newer), a.ctx.key)
    server.version++
    const version = server.version
    a.data.oneTimeExpenses.push(coffee('da-a'))
    await expect(a.sync()).rejects.toBeInstanceOf(NewerFormatError)
    expect(server.version).toBe(version)
  })

  it('dopo l\'aggiornamento il primo giro porta il server al formato corrente', async () => {
    const server = new FakeServer()
    const old = { ...emptyData(), schemaVersion: 2 } as unknown as FinanceData
    const a = new Device(server, old)
    await a.connect()
    // Al riavvio l'app aggiornata rilegge i dati salvati, che passano al formato corrente.
    a.data = parseBackup(JSON.parse(JSON.stringify(a.data)))
    await a.sync()
    const b = new Device(server)
    await b.connect()
    expect(b.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })
})

describe('aggiornamento dell\'app', () => {
  it('la prima sincronizzazione dopo l\'aggiornamento non annulla le modifiche fatte su un altro dispositivo', async () => {
    const server = new FakeServer()
    const income = { id: 'i1', name: 'Stipendio', amount: 100000, date: '2026-11-01', categoryId: 'cat', paymentMethodId: 'pm' }
    const gone = { ...income, id: 'i2', name: 'Rimborso' }
    // Dati come li scriveva l'app precedente: entrate senza note e tag.
    const old = { ...emptyData(), schemaVersion: 2, incomes: [income, gone] } as unknown as FinanceData
    const a = new Device(server, structuredClone(old))
    await a.connect()
    const b = new Device(server, structuredClone(old))
    await b.connect()
    // Sull'altro dispositivo (ancora con l'app precedente) un'entrata cambia e una sparisce.
    b.data.incomes = [{ ...income, amount: 120000 }] as FinanceData['incomes']
    await b.sync()
    // Questo dispositivo si aggiorna: al riavvio i dati salvati passano al formato corrente, la base no.
    a.data = parseBackup(JSON.parse(JSON.stringify(a.data)))
    await a.sync()
    expect(a.data.incomes.map((i) => [i.id, i.amount])).toEqual([['i1', 120000]])
  })
})
