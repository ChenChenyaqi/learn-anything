import { ref } from 'vue';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type Locale = 'en' | 'zh-CN';

export type I18nKey =
  | 'dashboard.title'
  | 'dashboard.noTopics'
  | 'dashboard.startLearning'
  | 'dashboard.topicCount'
  | 'topic.progress'
  | 'topic.domains'
  | 'topic.concepts'
  | 'topic.mastered'
  | 'topic.notFound'
  | 'domain.notes'
  | 'domain.exercises'
  | 'domain.noNotes'
  | 'domain.noExercises'
  | 'domain.backToMap'
  | 'domain.selectFile'
  | 'status.mastered'
  | 'status.inProgress'
  | 'status.needsPractice'
  | 'status.unexplored'
  | 'sidebar.topics'
  | 'sidebar.exercises'
  | 'sidebar.quizzes'
  | 'sidebar.noNotes'
  | 'sidebar.noExercises'
  | 'sidebar.orphanTip'
  | 'quiz.empty'
  | 'quiz.start'
  | 'quiz.previous'
  | 'quiz.next'
  | 'quiz.submit'
  | 'quiz.retry'
  | 'quiz.complete'
  | 'quiz.score'
  | 'quiz.correct'
  | 'quiz.incorrect'
  | 'quiz.referenceAnswer'
  | 'quiz.backToList'
  | 'quiz.questionProgress'
  | 'quiz.true'
  | 'quiz.false'
  | 'quiz.typeAnswer'
  | 'quiz.fixError'
  | 'quiz.typeMultipleChoice'
  | 'quiz.typeTrueFalse'
  | 'quiz.typeFillBlank'
  | 'quiz.typeErrorCorrection'
  | 'quiz.yourAnswer'
  | 'quiz.correctAnswer'
  | 'quiz.manualEvaluation'
  | 'quiz.helpTitle'
  | 'quiz.hintChoice'
  | 'quiz.hintTrueFalse'
  | 'quiz.hintNav'
  | 'quiz.hintSubmit'
  | 'quiz.allQuizzes'
  | 'quiz.groupProgress'
  | 'quiz.sequential'
  | 'quiz.random'
  | 'quiz.retryGroup'
  | 'quiz.nextGroup'
  | 'quiz.viewSummary'
  | 'quiz.allComplete'
  | 'quiz.totalScore'
  | 'quiz.loadError'
  | 'search.placeholder'
  | 'search.noResults'
  | 'search.open'
  | 'search.shortcutMac'
  | 'search.shortcutNonMac'
  | 'lang.switch'
  | 'theme.switch'
  | 'loading.note'
  | 'toc.title';

type Messages = Record<I18nKey, string>;

/* ------------------------------------------------------------------ */
/*  Message tables                                                    */
/* ------------------------------------------------------------------ */

const messages: Record<Locale, Messages> = {
  en: {
    'dashboard.title': 'Learning Dashboard',
    'dashboard.noTopics': 'No topics yet',
    'dashboard.startLearning': 'Run `learn-anything init` to start your first topic',
    'dashboard.topicCount': '{count} {count, plural, one {topic} other {topics}}',
    'topic.progress': 'Progress',
    'topic.domains': 'Domains',
    'topic.concepts': 'Concepts',
    'topic.mastered': 'Mastered',
    'topic.notFound': 'Topic not found',
    'domain.notes': 'Notes',
    'domain.exercises': 'Exercises',
    'domain.noNotes': 'No session notes yet',
    'domain.noExercises': 'No exercises yet',
    'domain.backToMap': '← Back to Knowledge Map',
    'domain.selectFile': 'Select a file to view its content',
    'status.mastered': 'Mastered',
    'status.inProgress': 'In Progress',
    'status.needsPractice': 'Needs Practice',
    'status.unexplored': 'Unexplored',
    'lang.switch': '中文',
    'theme.switch': 'Toggle theme',
    'sidebar.topics': 'Topics',
    'sidebar.exercises': 'Exercises',
    'sidebar.quizzes': 'Quizzes',
    'sidebar.noNotes': 'No sessions',
    'sidebar.noExercises': 'No exercises',
    'sidebar.orphanTip': 'This folder is not part of the knowledge map',
    'quiz.empty': 'No quizzes yet',
    'quiz.start': 'Start quiz',
    'quiz.previous': 'Previous',
    'quiz.next': 'Next',
    'quiz.submit': 'Submit',
    'quiz.retry': 'Retry Quiz',
    'quiz.complete': 'Quiz Complete',
    'quiz.score': 'Score',
    'quiz.correct': 'Correct',
    'quiz.incorrect': 'Incorrect',
    'quiz.referenceAnswer': 'Reference Answer',
    'quiz.backToList': 'Back to list',
    'quiz.questionProgress': 'Question {current} / {total}',
    'quiz.true': 'True',
    'quiz.false': 'False',
    'quiz.typeAnswer': 'Type your answer…',
    'quiz.fixError': 'Identify and fix the error…',
    'quiz.typeMultipleChoice': 'Multiple Choice',
    'quiz.typeTrueFalse': 'True / False',
    'quiz.typeFillBlank': 'Fill in the Blank',
    'quiz.typeErrorCorrection': 'Error Correction',
    'quiz.yourAnswer': 'Your answer',
    'quiz.correctAnswer': 'Correct answer',
    'quiz.manualEvaluation': 'Requires manual evaluation',
    'quiz.helpTitle': 'Keyboard Shortcuts',
    'quiz.hintChoice': 'Press A / B / C / D to select an option',
    'quiz.hintTrueFalse': 'Press 1 / 2 for True / False',
    'quiz.hintNav': '← / → to switch questions',
    'quiz.hintSubmit': 'Press {key} + Enter to submit',
    'quiz.allQuizzes': 'All Quizzes',
    'quiz.groupProgress': 'Group {current} / {total}',
    'quiz.sequential': 'Practice in order',
    'quiz.random': 'Practice shuffled',
    'quiz.retryGroup': 'Retry this group',
    'quiz.nextGroup': 'Next group',
    'quiz.viewSummary': 'View all results',
    'quiz.allComplete': 'All Complete',
    'quiz.totalScore': 'Total Score',
    'quiz.loadError': 'Failed to load quiz. Please try again.',
    'search.placeholder': 'Search notes…',
    'search.noResults': 'No matching notes',
    'search.open': 'Open search',
    'search.shortcutMac': '⌘K',
    'search.shortcutNonMac': 'Ctrl K',
    'loading.note': 'Opening note…',
    'toc.title': 'On this page',
  },
  'zh-CN': {
    'dashboard.title': '学习仪表盘',
    'dashboard.noTopics': '暂无学习主题',
    'dashboard.startLearning': '运行 `learn-anything init` 开始你的第一个学习主题',
    'dashboard.topicCount': '{count} 个主题',
    'topic.progress': '学习进度',
    'topic.domains': '知识域',
    'topic.concepts': '概念',
    'topic.mastered': '已掌握',
    'topic.notFound': '未找到主题',
    'domain.notes': '笔记',
    'domain.exercises': '练习',
    'domain.noNotes': '暂无笔记',
    'domain.noExercises': '暂无练习',
    'domain.backToMap': '← 返回知识地图',
    'domain.selectFile': '选择文件查看内容',
    'status.mastered': '已掌握',
    'status.inProgress': '学习中',
    'status.needsPractice': '需练习',
    'status.unexplored': '未探索',
    'lang.switch': 'English',
    'theme.switch': '切换主题',
    'sidebar.topics': '笔记',
    'sidebar.exercises': '练习',
    'sidebar.quizzes': '测验',
    'sidebar.noNotes': '没有笔记',
    'sidebar.noExercises': '没有练习',
    'sidebar.orphanTip': '此目录不在知识地图中',
    'quiz.empty': '暂无测验',
    'quiz.start': '开始测验',
    'quiz.previous': '上一题',
    'quiz.next': '下一题',
    'quiz.submit': '提交',
    'quiz.retry': '重新测验',
    'quiz.complete': '测验完成',
    'quiz.score': '得分',
    'quiz.correct': '正确',
    'quiz.incorrect': '错误',
    'quiz.referenceAnswer': '参考答案',
    'quiz.backToList': '返回列表',
    'quiz.questionProgress': '第 {current} / {total} 题',
    'quiz.true': '正确',
    'quiz.false': '错误',
    'quiz.typeAnswer': '输入你的答案…',
    'quiz.fixError': '找出并修正错误…',
    'quiz.typeMultipleChoice': '选择题',
    'quiz.typeTrueFalse': '判断题',
    'quiz.typeFillBlank': '填空题',
    'quiz.typeErrorCorrection': '纠错题',
    'quiz.yourAnswer': '你的答案',
    'quiz.correctAnswer': '正确答案',
    'quiz.manualEvaluation': '需要人工评估',
    'quiz.helpTitle': '键盘快捷键',
    'quiz.hintChoice': '按 A / B / C / D 选择选项',
    'quiz.hintTrueFalse': '按 1 / 2 选择对错',
    'quiz.hintNav': '← / → 切换题目',
    'quiz.hintSubmit': '按 {key} + Enter 提交',
    'quiz.allQuizzes': '全部测验',
    'quiz.groupProgress': '第 {current} / {total} 组',
    'quiz.sequential': '顺序练习',
    'quiz.random': '随机练习',
    'quiz.retryGroup': '重做本组',
    'quiz.nextGroup': '下一组',
    'quiz.viewSummary': '查看总成绩',
    'quiz.allComplete': '全部完成',
    'quiz.totalScore': '总得分',
    'quiz.loadError': '加载测验失败，请重试。',
    'search.placeholder': '搜索笔记…',
    'search.noResults': '没有匹配的笔记',
    'search.open': '打开搜索',
    'search.shortcutMac': '⌘K',
    'search.shortcutNonMac': 'Ctrl K',
    'loading.note': '正在打开笔记',
    'toc.title': '本页内容',
  },
};

/* ------------------------------------------------------------------ */
/*  Shared state (singleton across components)                        */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'learn-anything-locale';
const THEME_KEY = 'learn-anything-theme';

function detectLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en') return stored;
  return 'en';
}

const locale = ref<Locale>(detectLocale());

/* ------------------------------------------------------------------ */
/*  Composable                                                        */
/* ------------------------------------------------------------------ */

export function useI18n() {
  const t = (key: I18nKey): string => {
    return messages[locale.value][key];
  };

  const toggleLocale = (): void => {
    locale.value = locale.value === 'en' ? 'zh-CN' : 'en';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale.value);
    }
  };

  const setLocale = (next: Locale): void => {
    locale.value = next;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const isDark = ref<boolean>(
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  );

  const toggleDarkMode = (): void => {
    const next = !isDark.value;
    isDark.value = next;
    document.documentElement.classList.toggle('dark', next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    }
  };

  return { locale, t, toggleLocale, setLocale, isDark, toggleDarkMode };
}
