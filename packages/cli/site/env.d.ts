/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module '*.md' {
  const content: string;
  export default content;
}

declare module 'markdown-it/lib/rules_inline/emphasis.mjs' {
  const emphasis: {
    tokenize: (state: any, silent: boolean) => boolean;

    postProcess: (state: any) => void;
  };
  export default emphasis;
}
