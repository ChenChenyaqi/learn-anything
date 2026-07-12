// Reconstruct a CLI-style one-line summary from a tool name and its raw
// arguments (as received from the LLM).  Used by ToolCallCard to replace the
// "name + JSON args" display with a natural command-like representation.
//
// Large payloads (write content, edit edits, multi-line bash commands) are
// returned as an optional body so ToolCallCard can show them in a clamped
// ExpandableCode instead of jamming everything into the header.

type ToolDisplay = {
  /** CLI-style one-liner (e.g. `$ ls -la`, `cat src/foo.ts`). */
  summary: string;
  /** Optional large payload to show in an expandable code block. */
  body?: { content: string };
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** Safe JSON stringifier that never throws. */
function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function summarizeToolCall(name: string, args: unknown): ToolDisplay {
  const a = (args ?? {}) as Record<string, unknown>;

  switch (name) {
    /* ------------------------------------------------------------------ */
    /*  bash                                                              */
    /* ------------------------------------------------------------------ */
    case 'bash': {
      const cmd = str(a.command) ?? '';
      if (cmd.includes('\n') || cmd.length > 120) {
        return { summary: '$ (command)', body: { content: cmd } };
      }
      return { summary: `$ ${cmd}` };
    }

    /* ------------------------------------------------------------------ */
    /*  read                                                              */
    /* ------------------------------------------------------------------ */
    case 'read': {
      const path = str(a.path) ?? '';
      const hints: string[] = [];
      if (typeof a.offset === 'number') hints.push(`offset ${a.offset}`);
      if (typeof a.limit === 'number') hints.push(`limit ${a.limit}`);
      const suffix = hints.length ? `  (${hints.join(', ')})` : '';
      return { summary: `cat ${path}${suffix}` };
    }

    /* ------------------------------------------------------------------ */
    /*  write                                                             */
    /* ------------------------------------------------------------------ */
    case 'write': {
      const content = str(a.content) ?? '';
      return {
        summary: `write ${str(a.path) ?? ''}`,
        body: content ? { content } : undefined,
      };
    }

    /* ------------------------------------------------------------------ */
    /*  edit                                                              */
    /* ------------------------------------------------------------------ */
    case 'edit': {
      const edits = Array.isArray(a.edits) ? (a.edits as Array<Record<string, unknown>>) : [];
      const parts = edits.map((e, i) => {
        const old = str(e.oldText) ?? '';
        const n = str(e.newText) ?? '';
        return `--- edit ${i + 1} ---\n- ${old}\n+ ${n}`;
      });
      const body = parts.length ? parts.join('\n\n') : '';
      return {
        summary: `edit ${str(a.path) ?? ''}`,
        body: body ? { content: body } : undefined,
      };
    }

    /* ------------------------------------------------------------------ */
    /*  grep                                                              */
    /* ------------------------------------------------------------------ */
    case 'grep': {
      const flags: string[] = [];
      if (a.ignoreCase) flags.push('-i');
      if (a.literal) flags.push('-F');
      if (typeof a.context === 'number') flags.push(`-C ${a.context}`);
      const glob = str(a.glob);
      if (glob) flags.push(`-g ${glob}`);
      const flagStr = flags.length ? flags.join(' ') + ' ' : '';
      return {
        summary: `grep ${flagStr}"${str(a.pattern) ?? ''}" ${str(a.path) ?? '.'}`,
      };
    }

    /* ------------------------------------------------------------------ */
    /*  find                                                              */
    /* ------------------------------------------------------------------ */
    case 'find':
      return { summary: `fd "${str(a.pattern) ?? ''}" ${str(a.path) ?? '.'}` };

    /* ------------------------------------------------------------------ */
    /*  ls                                                                */
    /* ------------------------------------------------------------------ */
    case 'ls':
      return { summary: `ls ${str(a.path) ?? '.'}` };

    /* ------------------------------------------------------------------ */
    /*  Unknown tool — graceful fallback                                   */
    /* ------------------------------------------------------------------ */
    default: {
      const json = args != null ? safeJson(args) : '';
      return {
        summary: name,
        body: json && json !== '{}' ? { content: json } : undefined,
      };
    }
  }
}
