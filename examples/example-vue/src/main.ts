import { createApp } from 'vue';
import * as VueRouter from 'vue-router';

import './style.css';
import App from './App.vue';

const history = VueRouter.createWebHistory();

const router = VueRouter.createRouter({
  history,
  routes: [
    {
      path: '/',
      name: 'main',
      component: () => import('./components/MainPage.vue'),
    },
    {
      path: '/editor-yjs',
      name: 'editor-yjs',
      component: () => import('./components/EditorYjs.vue'),
    },
    {
      path: '/editor-code',
      name: 'editor-code',
      component: () => import('./components/EditorCode.vue'),
    },
  ],
});

const app = createApp(App);

app.use(router);

app.mount('#app');
