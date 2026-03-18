import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/Dashboard.vue'),
    },
    {
      path: '/members',
      name: 'Members',
      component: () => import('../views/Members.vue'),
    },
    {
      path: '/transactions',
      name: 'Transactions',
      component: () => import('../views/Transactions.vue'),
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/Settings.vue'),
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('auth_token');
  if (to.path !== '/login' && !token) {
    next('/login');
    return;
  }
  if (to.path === '/login' && token) {
    next('/');
    return;
  }
  next();
});

export default router;
