# Chrome Web Store Submission Notes

## Store name

ChatGPT Thread Toolkit

## Category

Productivity

## Short description

Keep long ChatGPT threads responsive with local compaction and Markdown/JSONL export.

## Detailed description

ChatGPT Thread Toolkit is a focused Chrome extension for long ChatGPT conversations.

It adds a small floating action menu inside supported ChatGPT threads so you can:

- compact older heavy turns while keeping recent context visible,
- enable per-chat auto-collapse for specific conversation URLs,
- export the full current conversation as Markdown,
- export the same conversation as JSONL with only `role` and `text`.

The extension is intentionally lightweight. It does not add a second complex UI layer on top of ChatGPT. The toolbar popup only confirms whether the current tab is supported and points the user back to the in-page floating menu.

All processing stays local in the browser. No chat content is uploaded anywhere, and the extension does not include analytics, telemetry, or third-party services.

## Permissions and justification

### `storage`

Used to persist the list of ChatGPT conversation URL paths where the user enabled `Auto-collapse here`.

### `activeTab`

Used by the toolbar popup to inspect the currently active tab after the user clicks the extension action, so the popup can tell whether the tab is a supported ChatGPT conversation.

### Host permissions

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

Used so the content script can run on supported ChatGPT pages and inject the floating action menu.

## Screenshot assets

- Repository preview screenshot: `docs/thread-toolkit-menu.png`
- Store-specific screenshots and promo tiles should be generated locally when preparing a submission package.

## Privacy policy

Use `docs/extension-privacy.md` as the source privacy policy text and host it in your preferred format when preparing a submission.
