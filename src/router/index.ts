import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'

export const TABS = [
  { name: 'dashboard', path: '/', icon: 'fa-chart-pie' },
  { name: 'onetime', path: '/una-tantum', icon: 'fa-receipt' },
  { name: 'recurring', path: '/ricorrenti', icon: 'fa-rotate' },
  { name: 'income', path: '/entrate', icon: 'fa-arrow-trend-up' },
  { name: 'budget', path: '/budget', icon: 'fa-wallet' },
  { name: 'loans', path: '/prestiti', icon: 'fa-hand-holding-dollar' },
  { name: 'forecast', path: '/previsioni', icon: 'fa-chart-line' },
  { name: 'settings', path: '/impostazioni', icon: 'fa-gear' },
] as const

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // `periodInPage`: la pagina ha il selettore del periodo (MonthSelector), che contiene anche l'anno; la barra in alto
    // allora non mostra il suo menu dell'anno, così il periodo si sceglie da un posto solo.
    { path: '/', name: 'dashboard', component: DashboardView, meta: { periodInPage: true } },
    { path: '/una-tantum', name: 'onetime', component: () => import('@/views/OneTimeView.vue'), meta: { periodInPage: true } },
    { path: '/ricorrenti', name: 'recurring', component: () => import('@/views/RecurringView.vue') },
    { path: '/entrate', name: 'income', component: () => import('@/views/IncomeView.vue') },
    { path: '/budget', name: 'budget', component: () => import('@/views/BudgetView.vue') },
    { path: '/prestiti', name: 'loans', component: () => import('@/views/LoansView.vue') },
    { path: '/previsioni', name: 'forecast', component: () => import('@/views/ForecastView.vue') },
    { path: '/impostazioni', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    // Dettaglio di una riga della dashboard: tutte le voci di una categoria o di un metodo di pagamento nel periodo scelto.
    {
      path: '/dettaglio/:kind(categoria|metodo)/:id',
      name: 'detail',
      component: () => import('@/views/BreakdownDetailView.vue'),
      // Nel menu resta evidenziata la dashboard: il dettaglio è un suo approfondimento.
      meta: { navParent: 'dashboard', periodInPage: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // Tornando indietro (anche dal dettaglio alla dashboard) si ritrova il punto della pagina dove si era; altrimenti si parte dall'alto.
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
})
