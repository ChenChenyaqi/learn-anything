/* Simplified Chinese messages. Must mirror `en.ts` key-for-key — enforced
 * both at compile time (the `MessageSchema` annotation below) and at runtime
 * (the parity unit test in `test/i18n.test.ts`). */

import type { MessageSchema } from './en';

const zhCN: MessageSchema = {
  common: {
    loading: '加载中…',
    retry: '重试',
    back: '返回',
    save: '保存',
    saving: '保存中…',
    optional: '（可选）',
    fileNotFound: '未找到文件。',
  },
  app: {
    starting: '启动中…',
  },
  overview: {
    title: '你的学习',
    newTopic: '新建主题',
    subtitle: '{topics} 个主题 · {concepts} 个概念 · 已掌握 {mastered} · 总进度 {percentage}%',
    loadError: '无法加载主题列表：',
    emptyHint: '还没有主题。让 Agent 执行 {cmd} 创建新主题。',
    pickHint: '选择一个主题打开工作区，或让 Agent 执行 {cmd} 创建新主题。',
    statMastered: '已掌握 {mastered}/{total} · {percentage}%',
    statNotStarted: '已掌握 {mastered}/{total} · 尚未开始',
  },
  workspace: {
    knowledgeMap: '知识地图',
    overallSummary:
      '已掌握 {mastered} · 学习中 {inProgress} · 需练习 {needsPractice} · 未探索 {unexplored}',
    status: {
      mastered: '已掌握',
      inProgress: '学习中',
      needsPractice: '需练习',
      unexplored: '未探索',
    },
    confidence: '置信 {value}',
    practiceCount: '练习 {count} 次',
    explainCount: '讲解 {count} 次',
    loadError: '无法加载该主题：',
    backToTopics: '返回主题列表',
    topicNotFound: '未找到该主题。',
    tab: {
      learn: '学习',
      practice: '练习',
      review: '复习',
    },
    playAllSequential: '顺序练习全部',
    playAllShuffled: '随机练习全部',
    playSequential: '顺序练习',
    playShuffled: '随机练习',
    noFiles: '暂无文件。',
  },
  header: {
    settings: '设置',
    chooseFolder: '选择文件夹',
    change: '更改',
    noFolder: '未选择文件夹',
  },
  main: {
    pickFolderHint: '选择一个工作文件夹，开始创建主题。',
    openFolderError: '无法打开该文件夹：',
    chooseDifferentFolder: '选择其他文件夹',
  },
  setup: {
    subtitle: '配置服务商以开始使用。',
    provider: '服务商',
    providerOpenai: 'OpenAI 兼容',
    providerAnthropic: 'Anthropic',
    modelId: '模型 ID',
    modelPlaceholder: '例如 gpt-4o',
    baseUrl: 'Base URL',
    apiKey: 'API 密钥',
    // Interpolated with the masked key preview when a key is already stored.
    keyKept: '已保存为 {preview}，留空则保持不变',
    errorModelEmpty: '模型 ID 不能为空。',
    errorKeyMissing: '请先输入 API 密钥。',
    language: '语言',
    languageSystem: '跟随系统',
  },
  chat: {
    placeholder: '问点什么…',
    inputHint: '输入 {slash} 使用命令，或直接提问。',
    stop: '停止',
    send: '发送',
    result: '结果',
    sessions: '会话',
    back: '返回',
    searchPlaceholder: '搜索会话…',
    emptySessions: '还没有会话——返回并输入 {cmd} 开始。',
    msgCount: '{count} 条消息',
    cmd: {
      new: '开始新会话',
      sessions: '浏览历史会话',
      'learn-topic': '初始化或加载学习主题',
      'learn-explain': '深入讲解某个概念',
      'learn-practice': '动手编程练习',
      'learn-quiz': '快速文字问答测验',
      'learn-review': '复习学习进度',
      'learn-status': '可视化学习状态',
    },
  },
  time: {
    justNow: '刚刚',
    minAgo: '{n} 分钟前',
    hourAgo: '{n} 小时前',
    dayAgo: '{n} 天前',
  },
  quiz: {
    // footer navigation
    previous: '上一题',
    next: '下一题',
    submit: '提交',

    // results
    retry: '重做测验',
    complete: '测验完成',
    correct: '答对',
    referenceAnswer: '参考答案',
    backToList: '返回列表',

    // header progress (named-interpolation templates)
    questionProgress: '第 {current} / {total} 题',
    groupProgress: '第 {current} / {total} 组',

    // true/false
    true: '正确',
    false: '错误',

    // input placeholders
    typeAnswer: '输入你的答案…',
    fixError: '找出并改正错误…',

    // question type labels
    typeMultipleChoice: '单选题',
    typeMultiSelect: '多选题',
    typeTrueFalse: '判断题',
    typeFillBlank: '填空题',
    typeErrorCorrection: '改错题',

    // per-question review
    yourAnswer: '你的答案',
    correctAnswer: '正确答案',
    manualEvaluation: '需要人工评估',

    // help / shortcuts popover
    helpTitle: '键盘快捷键',
    helpShortcuts: '键盘快捷键',
    hintChoice: '按 A-D 或 1-4 选择',
    hintMultiSelect: '多选：按 A-D 或 1-4 切换',
    hintTrueFalse: '按 1 / 2 选择正确 / 错误',
    hintNav: '← / → 切换题目',
    hintSubmit: '按 {key} + Enter 提交',

    // batch / queue
    allQuizzes: '全部测验',
    retryGroup: '重做本组',
    nextGroup: '下一组',
    viewSummary: '查看全部结果',

    // summary
    allComplete: '全部完成',

    // errors
    loadError: '测验加载失败，请重试。',
  },
};

export default zhCN;
