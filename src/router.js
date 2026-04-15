import { createRouter, createWebHashHistory } from 'vue-router'

import HomePage     from './pages/HomePage.vue'
import LogPage      from './pages/LogPage.vue'
import InsightsPage from './pages/InsightsPage.vue'
import HistoryPage  from './pages/HistoryPage.vue'
import TaperPage    from './pages/TaperPage.vue'
import SettingsPage from './pages/SettingsPage.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',         name: 'home',     component: HomePage },
    { path: '/log',      name: 'log',      component: LogPage },
    { path: '/insights', name: 'insights', component: InsightsPage },
    { path: '/history',  name: 'history',  component: HistoryPage },
    { path: '/taper',    name: 'taper',    component: TaperPage },
    { path: '/settings', name: 'settings', component: SettingsPage },
  ],
})
