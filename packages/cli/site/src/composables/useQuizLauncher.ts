import { ref, type ComputedRef } from 'vue';
import { fetchQuizDeck } from '@/components/quiz/quizApi';
import type { QuizDeck, QueueItem } from '@/components/quiz/types';

export function useQuizLauncher(currentTopicSlug: ComputedRef<string | undefined>) {
  const quizOpen = ref(false);
  const quizDeck = ref<QuizDeck | null>(null);
  const quizQueue = ref<{ items: QueueItem[]; mode: 'sequential' | 'random' } | null>(null);
  const quizSessionKey = ref(0);

  async function onQuizSelected(quiz: { path: string }) {
    if (!currentTopicSlug.value) return;
    try {
      quizQueue.value = null;
      quizDeck.value = await fetchQuizDeck(currentTopicSlug.value, quiz.path);
      quizSessionKey.value++;
      quizOpen.value = true;
    } catch (e) {
      console.error('Failed to load quiz:', e);
    }
  }

  function onQuizBatchSelected(batch: { items: QueueItem[]; mode: 'sequential' | 'random' }) {
    if (!currentTopicSlug.value) return;
    quizDeck.value = null;
    quizQueue.value = batch;
    quizSessionKey.value++;
    quizOpen.value = true;
  }

  return { quizOpen, quizDeck, quizQueue, quizSessionKey, onQuizSelected, onQuizBatchSelected };
}
