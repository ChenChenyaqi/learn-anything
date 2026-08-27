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
    fileNotFound: '未找到文件。',
  },
  setup: {
    language: '语言',
    languageSystem: '跟随系统',
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
