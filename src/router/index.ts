import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'

export const TABS = [
  { name: 'dashboard', path: '/', icon: 'fa-chart-pie' },
  { name: 'onetime', path: '/una-tantum', icon: 'fa-receipt' },
  { name: 'recurring', path: '/ricorrenti', icon: 'fa-rotate' },
  { name: 'income', path: '/entrate', icon: 'fa-arrow-trend-up' },
  { name: 'loans', path: '/prestiti', icon: 'fa-hand-holding-dollar' },
  { name: 'forecast', path: '/previsioni', icon: 'fa-chart-line' },
  { name: 'settings', path: '/impostazioni', icon: 'fa-gear' },
] as const

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/una-tantum', name: 'onetime', component: () => import('@/views/OneTimeView.vue') },
    { path: '/ricorrenti', name: 'recurring', component: () => import('@/views/RecurringView.vue') },
    { path: '/entrate', name: 'income', component: () => import('@/views/IncomeView.vue') },
    { path: '/prestiti', name: 'loans', component: () => import('@/views/LoansView.vue') },
    { path: '/previsioni', name: 'forecast', component: () => import('@/views/ForecastView.vue') },
    { path: '/impostazioni', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
