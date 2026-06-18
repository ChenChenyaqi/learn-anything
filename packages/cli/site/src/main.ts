import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { initTopicData } from './composables/useTopicData';
import './styles/main.css';

async function bootstrap() {
  await initTopicData();
  const app = createApp(App);
  app.use(router);
  app.mount('#app');
}

bootstrap();
