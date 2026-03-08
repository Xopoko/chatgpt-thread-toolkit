# ChatGPT Thread Toolkit Privacy Policy

Last updated: March 8, 2026

ChatGPT Thread Toolkit processes data locally inside the user's browser to improve long ChatGPT conversations and export the current thread on demand.

## What the extension does

- Injects a floating action menu on supported ChatGPT pages.
- Compacts older heavy messages to keep long threads responsive.
- Stores per-chat auto-collapse preferences in `chrome.storage.local`.
- Generates Markdown and JSONL exports locally when the user explicitly requests a download.

## Data collection

The extension does not collect, transmit, sell, or share personal data.

It does not send chat content, account information, or browsing activity to any remote server. It does not use analytics, telemetry, advertising SDKs, or external APIs.

## Data storage

The only persistent data stored by the extension is the local list of chat URL paths where `Auto-collapse here` has been enabled.

- Storage location: `chrome.storage.local`
- Stored value: sorted array of chat path strings
- Purpose: remember which ChatGPT threads should auto-collapse older messages

Markdown and JSONL exports are created locally and downloaded directly by the browser. The extension does not keep copies of exported chats.

## Permissions

- `storage`: required to save per-chat auto-collapse preferences.
- `activeTab`: required so the toolbar popup can understand whether the current tab is a supported ChatGPT page and guide the user accordingly.
- ChatGPT host permissions: required to run the content script on supported ChatGPT domains.

## Contact and source

This repository contains the full source code for the extension and its legacy userscript artifact.
