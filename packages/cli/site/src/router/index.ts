import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue'),
    },
    {
      path: '/topics/:slug',
      name: 'topic',
      component: () => import('@/views/TopicPage.vue'),
      props: true,
    },
  ],
  scrollBehavior(to) {
    if (to.hash) {
      if (document.querySelector(to.hash)) {
        return { el: to.hash, behavior: 'smooth' };
      }
      return false;
    }
    return { top: 0 };
  },
});

export default router;
