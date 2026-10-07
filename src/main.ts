import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { useFinanceStore } from './stores/finance'
import { requestPersistentStorage } from './services/storage'
import './style.css'

const app = createApp(App).use(createPinia()).use(router).use(i18n)
document.documentElement.lang = i18n.global.locale.value
app.mount('#app')

void useFinanceStore().init(i18n.global.locale.value)
void requestPersistentStorage()
