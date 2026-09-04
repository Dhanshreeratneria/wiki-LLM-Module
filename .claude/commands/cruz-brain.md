Ask Cruz Brain a question — Claude will answer from the wiki and auto-save the conversation as a thread in `wiki/threads/`.

The thread is saved as an MD file named `{user_name}-{thread_name}-{date}.md`. If a thread file for today already exists with the same user+thread name, the new turn is appended. Otherwise a fresh file is created.

The user name defaults to `claude-user`. To use a custom name, prefix your question like so:

```
/cruz-brain --user=alice What is the attention mechanism?
```

Steps:

1. Parse `$ARGUMENTS` to extract an optional `--user=NAME` flag (default: `claude-user`). The rest is the question.
2. Read `wiki/index.md` to find which pages are plausibly relevant.
3. Read only those pages (open more only if they lead to other relevant pages via `[[links]]`).
4. Formulate your answer, citing which wiki page(s) it came from.
5. If the wiki doesn't have enough to answer well, say so explicitly, give your best answer from general knowledge if useful, and ask whether you want the answer filed back into `wiki/` as a new page.
6. **Before outputting your response**, call the `cruz_brain_save_thread` MCP tool with:
   - `user_prompt`: the full user question
   - `ai_response`: your complete response text (exactly as you will output it)
   - `user_name`: the resolved user name from step 1
   - `thread_name`: omit to auto-derive from the question, or set explicitly if the question suggests one
7. After the tool call succeeds, output your full response to the user.

My question: $ARGUMENTS
