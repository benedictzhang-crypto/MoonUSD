import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import VaultView from '../views/VaultView.vue'
import DashboardView from '../views/DashboardView.vue'
import StressTestView from '../views/StressTestView.vue'
import UniswapView from '../views/UniswapView.vue'
import NotFoundView from '../views/NotFoundView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: 'MoonUSD | Home' },
  },
  {
    path: '/vault',
    name: 'vault',
    component: VaultView,
    meta: { title: 'MoonUSD | Vault' },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { title: 'MoonUSD | Dashboard' },
  },
  {
    path: '/stress-test',
    name: 'stress-test',
    component: StressTestView,
    meta: { title: 'MoonUSD | Stress Test' },
  },
  {
    path: '/uniswap',
    name: 'uniswap',
    component: UniswapView,
    meta: { title: 'MoonUSD | Uniswap Testnet' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { title: 'MoonUSD | Not Found' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' }
  },
})

router.afterEach((to) => {
  document.title = to.meta.title ?? 'MoonUSD'
})

export default router
