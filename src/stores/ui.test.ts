import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'

describe('useUiStore — azione "+" contestuale alla pagina', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('usa openQuickAdd come azione predefinita quando nessuna vista è registrata', () => {
    const ui = useUiStore()
    expect(ui.pageAction).toBeNull()
    ui.triggerPrimaryAdd()
    expect(ui.quickAddOpen).toBe(true)
  })

  it('esegue l’azione della vista registrata al posto di openQuickAdd', () => {
    const ui = useUiStore()
    const run = vi.fn()
    const owner = Symbol('income')

    ui.setPageAction(owner, { label: 'Nuova entrata', run })
    expect(ui.pageAction?.label).toBe('Nuova entrata')

    ui.triggerPrimaryAdd()
    expect(run).toHaveBeenCalledTimes(1)
    expect(ui.quickAddOpen).toBe(false)
  })

  it('non cancella l’azione della nuova vista se la vista precedente si smonta dopo', () => {
    const ui = useUiStore()
    const oldOwner = Symbol('old')
    const newOwner = Symbol('new')
    const oldRun = vi.fn()
    const newRun = vi.fn()

    ui.setPageAction(oldOwner, { label: 'Vecchia', run: oldRun })
    ui.setPageAction(newOwner, { label: 'Nuova', run: newRun })
    ui.clearPageAction(oldOwner)
    ui.setPageAction(oldOwner, null)

    expect(ui.pageAction?.label).toBe('Nuova')
    ui.triggerPrimaryAdd()
    expect(newRun).toHaveBeenCalledTimes(1)
    expect(oldRun).not.toHaveBeenCalled()
  })

  it('ripristina il fallback quando il proprietario corrente smonta o azzera l’azione', () => {
    const ui = useUiStore()
    const owner = Symbol('budget')
    ui.setPageAction(owner, { label: 'Nuovo salvadanaio', run: vi.fn() })
    ui.setPageAction(owner, null)

    expect(ui.pageAction).toBeNull()
    ui.triggerPrimaryAdd()
    expect(ui.quickAddOpen).toBe(true)
  })
})
