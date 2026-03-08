# Changelog

All notable changes to this project are documented in this file.

## 0.5.0 - 2026-03-08

- Added a store-ready Manifest V3 Chrome extension in `extension/` with the current toolkit feature set.
- Added a minimal toolbar popup for supported and unsupported tab states.
- Added Chrome Web Store packaging/docs assets, including privacy and listing copy.
- Switched the primary install path in the README from the userscript to the extension.
- Added a shared runtime guard so the userscript and extension do not both run on the same page.

## 0.4.1 - 2026-03-08

- Replaced the floating action button `+` icon with a layers-style glyph that better matches thread actions.
- Restyled the floating action menu and trigger button to better match the native ChatGPT interface.
- Updated the screenshot asset to reflect the real in-script appearance of the menu.

## 0.4.0 - 2026-03-08

- Added a per-chat `Auto-collapse here` toggle stored locally by chat URL path.
- Added automatic compaction for chats where auto-collapse is enabled.
- Updated documentation to describe the per-chat auto-collapse behavior.

## 0.3.0 - 2026-03-08

- Added `Download .jsonl` to export one JSON object per line with only `role` and `text`.
- Split export handling into dedicated Markdown and JSONL actions.
- Updated project copy to reflect dual export formats.

## 0.2.1 - 2026-03-06

- Replaced the userscript namespace with a project-specific identifier.
- Added an MIT license for public distribution.
- Added a license section to the README.

## 0.2.0 - 2026-03-06

- Added a lightweight floating action button with an upward action menu.
- Added `Compact Older` to reduce lag in long ChatGPT threads.
- Added `Download .md` to export the active conversation as Markdown.
- Preserved export support for messages that were already compacted.
- Tuned floating button spacing and menu presentation for desktop and mobile.
