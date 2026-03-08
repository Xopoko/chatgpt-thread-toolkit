/* ChatGPT Thread Toolkit content script */
(function () {
  'use strict';

  const GLOBAL_RUNTIME_KEY = '__chatgptThreadToolkitRuntime';
  const RUNTIME_NAME = 'chrome-extension';

  if (window[GLOBAL_RUNTIME_KEY]) {
    console.warn(`[Thread Toolkit] Skipping ${RUNTIME_NAME} runtime because ${window[GLOBAL_RUNTIME_KEY]} is already active.`);
    return;
  }

  window[GLOBAL_RUNTIME_KEY] = RUNTIME_NAME;

  const SETTINGS = {
    keepLast: 6,
    minNodesForManualCompact: 120,
    minTextForManualCompact: 250,
    panelDebounceMs: 250,
  };

  const AUTO_COMPACT_STORAGE_KEY = 'chatgpt-thread-toolkit:auto-collapse-paths';
  const PANEL_ID = 'chatgpt-thread-toolkit-panel';
  const STYLE_ID = 'chatgpt-thread-toolkit-style';
  const articleState = new WeakMap();

  let autoCollapseActionButton;
  let panel;
  let triggerButton;
  let menu;
  let autoCollapseChatKeys = new Set();
  let lastAutoCompactSignature = '';
  let lastKnownChatKey = location.pathname;
  let panelRefreshTimer = 0;
  let triggerStateTimer = 0;
  let storageReadyPromise = null;
  let storageSyncListenerInstalled = false;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      main article:not([data-codex-compacted="1"]) {
        content-visibility: auto;
        contain-intrinsic-size: 900px;
      }

      #${PANEL_ID} {
        position: fixed;
        right: 28px;
        bottom: 16px;
        z-index: 2147483647;
        color: rgba(255, 255, 255, 0.93);
        font-family: inherit;
        letter-spacing: -0.01em;
      }

      #${PANEL_ID}[data-hidden="1"] {
        opacity: 0;
        pointer-events: none;
        transform: translateY(8px);
      }

      #${PANEL_ID}[data-open="1"] [data-codex-menu] {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      #${PANEL_ID}[data-open="1"] [data-codex-trigger] {
        opacity: 1;
        transform: translateY(-1px);
        background: rgba(41, 41, 44, 0.96);
      }

      #${PANEL_ID} [data-codex-trigger] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        padding: 0;
        background: rgba(33, 33, 36, 0.9);
        color: rgba(255, 255, 255, 0.92);
        cursor: pointer;
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        backdrop-filter: blur(18px);
        opacity: 0.9;
        transition: opacity 140ms ease, transform 140ms ease, background-color 140ms ease, border-color 140ms ease;
      }

      #${PANEL_ID} [data-codex-trigger]:hover,
      #${PANEL_ID} [data-codex-trigger]:focus-visible {
        opacity: 1;
        transform: translateY(-1px);
        background: rgba(45, 45, 48, 0.96);
        border-color: rgba(255, 255, 255, 0.12);
        outline: none;
      }

      #${PANEL_ID} [data-codex-trigger][data-state="busy"] {
        opacity: 1;
        background: rgba(16, 92, 176, 0.92);
      }

      #${PANEL_ID} [data-codex-trigger][data-state="done"] {
        opacity: 1;
        background: rgba(12, 122, 83, 0.9);
      }

      #${PANEL_ID} [data-codex-trigger][data-state="error"] {
        opacity: 1;
        background: rgba(153, 32, 39, 0.92);
      }

      #${PANEL_ID} svg {
        width: 18px;
        height: 18px;
        pointer-events: none;
      }

      #${PANEL_ID} [data-codex-menu] {
        position: absolute;
        right: 0;
        bottom: 56px;
        display: grid;
        gap: 8px;
        min-width: 248px;
        padding: 8px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 24px;
        background: rgba(41, 41, 44, 0.82);
        box-shadow: 0 24px 56px rgba(7, 10, 19, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(22px) saturate(0.9);
        opacity: 0;
        pointer-events: none;
        transform: translateY(8px) scale(0.98);
        transform-origin: right bottom;
        transition: opacity 140ms ease, transform 140ms ease;
      }

      #${PANEL_ID} [data-codex-menu-item] {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 54px;
        border: 1px solid rgba(255, 255, 255, 0.035);
        border-radius: 18px;
        padding: 13px 14px;
        background: rgba(44, 44, 47, 0.9);
        color: rgba(255, 255, 255, 0.93);
        cursor: pointer;
        text-align: left;
        font: inherit;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.015);
        transition: background-color 120ms ease, transform 120ms ease, border-color 120ms ease;
      }

      #${PANEL_ID} [data-codex-menu-item]:hover,
      #${PANEL_ID} [data-codex-menu-item]:focus-visible {
        background: rgba(51, 51, 54, 0.96);
        border-color: rgba(255, 255, 255, 0.06);
        transform: translateY(-1px);
        outline: none;
      }

      #${PANEL_ID} [data-codex-menu-item] strong {
        display: block;
        margin-bottom: 4px;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.18;
        letter-spacing: -0.02em;
      }

      #${PANEL_ID} [data-codex-menu-item] span {
        display: block;
        color: rgba(255, 255, 255, 0.62);
        font-size: 13px;
        line-height: 1.28;
        letter-spacing: -0.01em;
      }

      article[data-codex-compacted="1"] {
        content-visibility: visible !important;
        contain: layout style paint;
      }

      article[data-codex-compacted="1"] [data-codex-summary] {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        padding: 14px;
        margin: 8px 0;
        background: rgba(255, 255, 255, 0.03);
        color: inherit;
      }

      article[data-codex-compacted="1"] [data-codex-summary-title] {
        display: block;
        margin-bottom: 6px;
        font-weight: 700;
      }

      article[data-codex-compacted="1"] [data-codex-summary-preview] {
        margin-bottom: 10px;
        color: inherit;
        opacity: 0.78;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      article[data-codex-compacted="1"] [data-codex-summary-meta] {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        color: inherit;
        opacity: 0.85;
      }

      article[data-codex-compacted="1"] [data-codex-summary-meta] button {
        border: 0;
        border-radius: 999px;
        padding: 6px 10px;
        background: rgba(33, 33, 36, 0.94);
        color: rgba(255, 255, 255, 0.93);
        cursor: pointer;
        font: inherit;
      }

      @media (max-width: 640px) {
        #${PANEL_ID} {
          right: 20px;
          bottom: 12px;
        }

        #${PANEL_ID} [data-codex-menu] {
          min-width: min(232px, calc(100vw - 24px));
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createIcon(paths) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        ${paths.map((path) => `<path d="${path}"></path>`).join('')}
      </svg>
    `;
  }

  function createActionButton({ label, description, title, iconPaths, onClick }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.codexMenuItem = '1';
    button.title = title;
    button.innerHTML = `
      ${createIcon(iconPaths)}
      <div>
        <strong>${label}</strong>
        <span>${description}</span>
      </div>
    `;
    button.addEventListener('click', onClick);
    return button;
  }

  function updateActionButton(button, { label, description, title }) {
    if (!button) {
      return;
    }

    const labelNode = button.querySelector('strong');
    const descriptionNode = button.querySelector('span');
    if (labelNode) {
      labelNode.textContent = label;
    }
    if (descriptionNode) {
      descriptionNode.textContent = description;
    }
    button.title = title;
  }

  function getCurrentChatKey() {
    return location.pathname;
  }

  function normalizeAutoCollapseChatKeys(rawValue) {
    if (!Array.isArray(rawValue)) {
      return new Set();
    }

    return new Set(rawValue.filter((item) => typeof item === 'string' && item));
  }

  function readExtensionStorage(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(items[key]);
      });
    });
  }

  function writeExtensionStorage(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      });
    });
  }

  async function initializeAutoCollapseStorage() {
    if (storageReadyPromise) {
      return storageReadyPromise;
    }

    storageReadyPromise = readExtensionStorage(AUTO_COMPACT_STORAGE_KEY)
      .then((rawValue) => {
        autoCollapseChatKeys = normalizeAutoCollapseChatKeys(rawValue);
      })
      .catch((error) => {
        console.error('[Thread Toolkit] Failed to read auto-collapse settings.', error);
        autoCollapseChatKeys = new Set();
      });

    return storageReadyPromise;
  }

  async function persistAutoCollapseChatKeys() {
    try {
      await writeExtensionStorage(AUTO_COMPACT_STORAGE_KEY, Array.from(autoCollapseChatKeys).sort());
    } catch (error) {
      console.error('[Thread Toolkit] Failed to store auto-collapse settings.', error);
    }
  }

  function isAutoCollapseEnabledForChat(chatKey = getCurrentChatKey()) {
    return autoCollapseChatKeys.has(chatKey);
  }

  async function setAutoCollapseEnabledForChat(enabled, chatKey = getCurrentChatKey()) {
    if (!chatKey) {
      return enabled;
    }

    if (enabled) {
      autoCollapseChatKeys.add(chatKey);
    } else {
      autoCollapseChatKeys.delete(chatKey);
    }

    await persistAutoCollapseChatKeys();
    return enabled;
  }

  function updateAutoCollapseAction() {
    const enabled = isAutoCollapseEnabledForChat();
    updateActionButton(autoCollapseActionButton, {
      label: enabled ? 'Auto-collapse here: on' : 'Auto-collapse here: off',
      description: enabled
        ? 'Enabled only for this chat URL'
        : 'Enable automatic compaction only for this chat',
      title: enabled
        ? 'Disable automatic compaction for this chat'
        : 'Enable automatic compaction for this chat',
    });
  }

  function syncRouteState() {
    const currentChatKey = getCurrentChatKey();
    if (currentChatKey === lastKnownChatKey) {
      return false;
    }

    lastKnownChatKey = currentChatKey;
    lastAutoCompactSignature = '';
    closeMenu();
    return true;
  }

  function ensurePanel() {
    if (panel?.isConnected) {
      updatePanelVisibility();
      updateAutoCollapseAction();
      return;
    }

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.dataset.open = '0';

    menu = document.createElement('div');
    menu.dataset.codexMenu = '1';
    menu.setAttribute('role', 'menu');

    const compactAction = createActionButton({
      label: 'Compact Older',
      description: 'Collapse large older turns',
      title: 'Collapse older messages',
      iconPaths: ['M5 7h14', 'M5 12h10', 'M5 17h7', 'M16 10l3 2-3 2'],
      onClick: () => {
        closeMenu();
        compactOlderArticles();
        flashTriggerState('done', 850);
      },
    });

    autoCollapseActionButton = createActionButton({
      label: 'Auto-collapse here: off',
      description: 'Enable automatic compaction only for this chat',
      title: 'Enable automatic compaction for this chat',
      iconPaths: ['M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12', 'M12 12h.01'],
      onClick: () => {
        void handleAutoCollapseToggleAction();
      },
    });

    const exportAction = createActionButton({
      label: 'Download .md',
      description: 'Export the whole chat to Markdown',
      title: 'Download the whole chat as Markdown',
      iconPaths: ['M12 3v12', 'M8 11l4 4 4-4', 'M5 19h14'],
      onClick: () => {
        void handleMarkdownExportAction();
      },
    });

    const exportJsonlAction = createActionButton({
      label: 'Download .jsonl',
      description: 'Export only role and text per message',
      title: 'Download the whole chat as JSONL',
      iconPaths: ['M4 7h16', 'M7 12h10', 'M10 17h4'],
      onClick: () => {
        void handleJsonlExportAction();
      },
    });

    menu.append(compactAction, autoCollapseActionButton, exportAction, exportJsonlAction);

    triggerButton = document.createElement('button');
    triggerButton.type = 'button';
    triggerButton.dataset.codexTrigger = '1';
    triggerButton.setAttribute('aria-label', 'Thread actions');
    triggerButton.setAttribute('aria-haspopup', 'menu');
    triggerButton.setAttribute('aria-expanded', 'false');
    triggerButton.title = 'Thread actions';
    triggerButton.innerHTML = createIcon([
      'M12 4 4.5 8 12 12 19.5 8 12 4',
      'M6.5 11.5 12 14.5 17.5 11.5',
      'M6.5 15 12 18 17.5 15',
    ]);
    triggerButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMenu();
    });

    panel.append(menu, triggerButton);
    document.body.appendChild(panel);
    updatePanelVisibility();
    updateAutoCollapseAction();
  }

  function updatePanelVisibility() {
    if (!panel) {
      return;
    }

    panel.dataset.hidden = getArticles().length ? '0' : '1';
  }

  function isMenuOpen() {
    return panel?.dataset.open === '1';
  }

  function closeMenu() {
    if (!panel || !triggerButton) {
      return;
    }

    panel.dataset.open = '0';
    triggerButton.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    if (!panel || !triggerButton) {
      return;
    }

    panel.dataset.open = '1';
    triggerButton.setAttribute('aria-expanded', 'true');
  }

  function toggleMenu(forceOpen) {
    if (typeof forceOpen === 'boolean') {
      if (forceOpen) {
        openMenu();
      } else {
        closeMenu();
      }
      return;
    }

    if (isMenuOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function setTriggerState(state) {
    if (!triggerButton) {
      return;
    }

    triggerButton.dataset.state = state;
  }

  function flashTriggerState(state, durationMs) {
    setTriggerState(state);
    window.clearTimeout(triggerStateTimer);
    if (durationMs > 0) {
      triggerStateTimer = window.setTimeout(() => {
        setTriggerState('');
      }, durationMs);
    }
  }

  function schedulePanelRefresh() {
    window.clearTimeout(panelRefreshTimer);
    panelRefreshTimer = window.setTimeout(() => {
      syncRouteState();
      ensurePanel();
      maybeAutoCompactCurrentChat();
    }, SETTINGS.panelDebounceMs);
  }

  function getArticles() {
    const main = document.querySelector('main');
    if (!main) {
      return [];
    }

    return Array.from(main.querySelectorAll('article')).filter((article) => article.isConnected);
  }

  function countDescendants(element) {
    return element.getElementsByTagName('*').length;
  }

  function normalizeRole(role) {
    if (!role) {
      return 'Message';
    }

    if (role === 'user') {
      return 'You';
    }

    if (role === 'assistant') {
      return 'Assistant';
    }

    return role[0].toUpperCase() + role.slice(1);
  }

  function normalizeJsonlRole(role) {
    if (!role) {
      return 'message';
    }

    if (role === 'user' || role === 'assistant') {
      return role;
    }

    return role.toLowerCase();
  }

  function getTextPreview(article, maxLength = 180) {
    const text = (article.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) {
      return text || 'No preview available.';
    }

    return `${text.slice(0, maxLength)}...`;
  }

  function getArticleRole(article) {
    const authorNode = article.querySelector('[data-message-author-role]');
    const storedRole = articleState.get(article)?.rawRole;
    return normalizeRole(authorNode?.getAttribute('data-message-author-role') || storedRole);
  }

  function getArticleRawRole(article) {
    const authorNode = article.querySelector('[data-message-author-role]');
    const storedRole = articleState.get(article)?.rawRole;
    return normalizeJsonlRole(authorNode?.getAttribute('data-message-author-role') || storedRole);
  }

  function buildSummary(article, stats) {
    const wrapper = document.createElement('div');
    wrapper.dataset.codexSummary = '1';

    const title = document.createElement('span');
    title.dataset.codexSummaryTitle = '1';
    title.textContent = `${getArticleRole(article)} collapsed`;

    const preview = document.createElement('div');
    preview.dataset.codexSummaryPreview = '1';
    preview.textContent = stats.preview;

    const meta = document.createElement('div');
    meta.dataset.codexSummaryMeta = '1';

    const detail = document.createElement('span');
    detail.textContent = `${stats.nodeCount.toLocaleString()} DOM nodes, ${stats.textLength.toLocaleString()} chars`;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Expand';
    button.addEventListener('click', () => {
      restoreArticle(article);
    });

    meta.append(detail, button);
    wrapper.append(title, preview, meta);
    return wrapper;
  }

  function getArticleStats(article) {
    const text = (article.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      nodeCount: countDescendants(article),
      textLength: text.length,
      preview: text.length ? getTextPreview(article) : 'No preview available.',
    };
  }

  function compactArticle(article, stats = getArticleStats(article)) {
    if (articleState.has(article)) {
      return false;
    }

    const savedNodes = Array.from(article.childNodes);
    if (!savedNodes.length) {
      return false;
    }

    const summary = buildSummary(article, stats);
    article.replaceChildren(summary);
    article.dataset.codexCompacted = '1';
    articleState.set(article, { rawRole: getArticleRawRole(article), savedNodes, stats });
    return true;
  }

  function restoreArticle(article) {
    const saved = articleState.get(article);
    if (!saved) {
      return false;
    }

    article.replaceChildren(...saved.savedNodes);
    article.removeAttribute('data-codex-compacted');
    articleState.delete(article);
    return true;
  }

  function createAutoCompactSignature(articles = getArticles()) {
    return `${getCurrentChatKey()}::${articles.length}`;
  }

  function compactOlderArticles() {
    const articles = getArticles();
    if (!articles.length) {
      return 0;
    }

    let compactedCount = 0;
    for (let index = 0; index < articles.length; index += 1) {
      const article = articles[index];
      const isRecent = index >= articles.length - SETTINGS.keepLast;
      if (isRecent || articleState.has(article)) {
        continue;
      }

      const stats = getArticleStats(article);
      const minNodes = SETTINGS.minNodesForManualCompact;
      const minText = SETTINGS.minTextForManualCompact;

      if (stats.nodeCount < minNodes && stats.textLength < minText) {
        continue;
      }

      if (compactArticle(article, stats)) {
        compactedCount += 1;
      }
    }

    return compactedCount;
  }

  function maybeAutoCompactCurrentChat({ force = false } = {}) {
    if (!isAutoCollapseEnabledForChat()) {
      return 0;
    }

    const articles = getArticles();
    if (!articles.length) {
      return 0;
    }

    const signature = createAutoCompactSignature(articles);
    if (!force) {
      if (signature === lastAutoCompactSignature) {
        return 0;
      }
    }

    const compactedCount = compactOlderArticles();
    lastAutoCompactSignature = signature;
    return compactedCount;
  }

  async function handleAutoCollapseToggleAction() {
    closeMenu();
    const enabled = await setAutoCollapseEnabledForChat(!isAutoCollapseEnabledForChat());
    updateAutoCollapseAction();

    if (enabled) {
      maybeAutoCompactCurrentChat({ force: true });
    }

    flashTriggerState('done', 850);
  }

  function installStorageSyncListener() {
    if (storageSyncListenerInstalled) {
      return;
    }

    storageSyncListenerInstalled = true;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[AUTO_COMPACT_STORAGE_KEY]) {
        return;
      }

      autoCollapseChatKeys = normalizeAutoCollapseChatKeys(changes[AUTO_COMPACT_STORAGE_KEY].newValue);
      lastAutoCompactSignature = '';
      updateAutoCollapseAction();
      schedulePanelRefresh();
    });
  }

  function getArticleSourceNodes(article) {
    const saved = articleState.get(article);
    return saved ? saved.savedNodes : Array.from(article.childNodes);
  }

  function createArticleSnapshot(article) {
    const wrapper = document.createElement('div');
    for (const node of getArticleSourceNodes(article)) {
      wrapper.appendChild(node.cloneNode(true));
    }
    return wrapper;
  }

  function sanitizeExportRoot(root) {
    const removableSelector = [
      'button.behavior-btn',
      'nav',
      'form',
      'textarea',
      'input',
      'select',
      'option',
      'script',
      'style',
      '[data-codex-summary]',
      '.sr-only',
      '[class*="sr-only"]',
    ].join(', ');

    for (const element of root.querySelectorAll(removableSelector)) {
      element.remove();
    }
  }

  function cleanInlineText(text) {
    return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cleanupMarkdown(text) {
    return text
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function serializeChildren(node, context) {
    return Array.from(node.childNodes).map((child) => serializeNode(child, context)).join('');
  }

  function serializeList(listElement, context) {
    const ordered = listElement.tagName.toLowerCase() === 'ol';
    const items = Array.from(listElement.children).filter((child) => child.tagName?.toLowerCase() === 'li');
    if (!items.length) {
      return '';
    }

    return `\n${items.map((item, index) => serializeListItem(item, {
      depth: context.depth + 1,
      ordered,
      index: index + 1,
    })).join('\n')}\n`;
  }

  function serializeListItem(item, context) {
    const indent = '  '.repeat(Math.max(context.depth - 1, 0));
    const prefix = context.ordered ? `${context.index}. ` : '- ';

    let inlineText = '';
    const nestedBlocks = [];

    for (const child of item.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'ul' || tag === 'ol') {
          nestedBlocks.push(serializeList(child, { depth: context.depth }));
          continue;
        }
        if (tag === 'pre' || tag === 'table' || tag === 'blockquote') {
          nestedBlocks.push(serializeNode(child, { depth: context.depth }));
          continue;
        }
      }

      inlineText += serializeNode(child, { depth: context.depth });
    }

    const mainLine = cleanInlineText(inlineText);
    let result = `${indent}${prefix}${mainLine}`.trimEnd();

    for (const block of nestedBlocks) {
      const lines = cleanupMarkdown(block).split('\n');
      const nested = lines.map((line) => (line ? `${indent}  ${line}` : line)).join('\n');
      result += `\n${nested}`;
    }

    return result;
  }

  function serializeTable(table) {
    const rows = Array.from(table.querySelectorAll('tr'))
      .map((row) => Array.from(row.children).map((cell) => cleanInlineText(cell.textContent || '').replace(/\|/g, '\\|')).filter(Boolean))
      .filter((row) => row.length);

    if (!rows.length) {
      return '';
    }

    const header = rows[0];
    const body = rows.slice(1);
    const lines = [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...body.map((row) => `| ${row.join(' | ')} |`),
    ];

    return `\n${lines.join('\n')}\n`;
  }

  function serializeBlockquote(element, context) {
    const text = cleanupMarkdown(serializeChildren(element, context));
    if (!text) {
      return '';
    }

    return `\n${text.split('\n').map((line) => `> ${line}`).join('\n')}\n`;
  }

  function serializePreformatted(element) {
    const code = element.querySelector('code');
    const source = code || element;
    const match = `${code?.className || ''} ${element.className || ''}`.match(/language-([\w-]+)/);
    const language = match ? match[1] : '';
    const text = (source.textContent || '').replace(/\u00a0/g, ' ').replace(/\n+$/, '');

    if (!text.trim()) {
      return '';
    }

    return `\n\`\`\`${language}\n${text}\n\`\`\`\n`;
  }

  function serializeNode(node, context) {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node;
    const tag = element.tagName.toLowerCase();

    if (['script', 'style', 'noscript', 'svg', 'path', 'button', 'input', 'textarea', 'select', 'option'].includes(tag)) {
      return '';
    }

    if (element.matches('.sr-only, [class*="sr-only"]')) {
      return '';
    }

    if (tag === 'br') {
      return '\n';
    }

    if (tag === 'hr') {
      return '\n---\n';
    }

    if (tag === 'pre') {
      return serializePreformatted(element);
    }

    if (tag === 'code') {
      if (element.parentElement?.tagName.toLowerCase() === 'pre') {
        return '';
      }
      const text = cleanInlineText(element.textContent || '');
      return text ? `\`${text}\`` : '';
    }

    if (tag === 'a') {
      const href = element.getAttribute('href');
      const text = cleanInlineText(serializeChildren(element, context) || element.textContent || '');
      if (!href || href.startsWith('#')) {
        return text;
      }
      return `[${text || href}](${href})`;
    }

    if (tag === 'img') {
      const src = element.getAttribute('src');
      const alt = cleanInlineText(element.getAttribute('alt') || 'Image');
      return src ? `![${alt}](${src})` : '';
    }

    if (tag === 'strong' || tag === 'b') {
      const text = cleanInlineText(serializeChildren(element, context));
      return text ? `**${text}**` : '';
    }

    if (tag === 'em' || tag === 'i') {
      const text = cleanInlineText(serializeChildren(element, context));
      return text ? `*${text}*` : '';
    }

    if (tag === 's' || tag === 'del') {
      const text = cleanInlineText(serializeChildren(element, context));
      return text ? `~~${text}~~` : '';
    }

    if (tag === 'blockquote') {
      return serializeBlockquote(element, context);
    }

    if (tag === 'ul' || tag === 'ol') {
      return serializeList(element, context);
    }

    if (tag === 'table') {
      return serializeTable(element);
    }

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const text = cleanInlineText(element.textContent || '');
      return text ? `\n${'#'.repeat(level)} ${text}\n` : '';
    }

    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main' || tag === 'header' || tag === 'footer' || tag === 'figure' || tag === 'figcaption') {
      const text = cleanupMarkdown(serializeChildren(element, context));
      return text ? `\n${text}\n` : '';
    }

    return serializeChildren(element, context);
  }

  function getTopLevelExportRoots(snapshot) {
    const selectors = [
      '[data-message-author-role="user"] .whitespace-pre-wrap',
      '[data-message-author-role="assistant"] .markdown',
      'div.user-message-bubble-color > div.whitespace-pre-wrap',
      'div.whitespace-pre-wrap',
      'div.markdown',
      'pre',
      'table',
    ].join(', ');

    const candidates = Array.from(snapshot.querySelectorAll(selectors));
    if (!candidates.length) {
      return [snapshot];
    }

    return candidates.filter((candidate, index) => {
      return !candidates.some((other, otherIndex) => {
        return otherIndex !== index && other.contains(candidate);
      });
    });
  }

  function extractPlainText(node) {
    const blockTags = new Set([
      'article', 'aside', 'blockquote', 'br', 'div', 'dl', 'dt', 'dd', 'figcaption', 'figure',
      'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'ol', 'p',
      'pre', 'section', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'ul',
    ]);

    function visit(current) {
      if (current.nodeType === Node.TEXT_NODE) {
        return current.textContent || '';
      }

      if (current.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const element = current;
      const tag = element.tagName.toLowerCase();

      if (['script', 'style', 'noscript', 'svg', 'path', 'button', 'input', 'textarea', 'select', 'option', 'nav', 'form'].includes(tag)) {
        return '';
      }

      if (element.matches('.sr-only, [class*="sr-only"]')) {
        return '';
      }

      if (tag === 'br') {
        return '\n';
      }

      if (tag === 'hr') {
        return '\n---\n';
      }

      if (tag === 'pre') {
        return serializePreformatted(element);
      }

      if (tag === 'a') {
        const text = cleanInlineText(Array.from(element.childNodes).map(visit).join('') || element.textContent || '');
        const href = element.getAttribute('href');
        if (!href || href.startsWith('#')) {
          return text;
        }
        if (!text) {
          return href;
        }
        return text === href ? text : `${text} (${href})`;
      }

      const content = Array.from(element.childNodes).map(visit).join('');
      if (!content) {
        return '';
      }

      return blockTags.has(tag) ? `\n${content}\n` : content;
    }

    return cleanupMarkdown(visit(node));
  }

  function extractPlainMessageText(node) {
    const blockTags = new Set([
      'article', 'aside', 'blockquote', 'br', 'div', 'dl', 'dt', 'dd', 'figcaption', 'figure',
      'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'ol', 'p',
      'pre', 'section', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'ul',
    ]);

    function visit(current) {
      if (current.nodeType === Node.TEXT_NODE) {
        return current.textContent || '';
      }

      if (current.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const element = current;
      const tag = element.tagName.toLowerCase();

      if (['script', 'style', 'noscript', 'svg', 'path', 'button', 'input', 'textarea', 'select', 'option', 'nav', 'form'].includes(tag)) {
        return '';
      }

      if (element.matches('.sr-only, [class*="sr-only"]')) {
        return '';
      }

      if (tag === 'br' || tag === 'hr') {
        return '\n';
      }

      if (tag === 'pre') {
        const source = element.querySelector('code') || element;
        const text = (source.textContent || '').replace(/\u00a0/g, ' ').replace(/\n+$/, '');
        return text ? `\n${text}\n` : '';
      }

      if (tag === 'a') {
        return Array.from(element.childNodes).map(visit).join('') || element.textContent || '';
      }

      const content = Array.from(element.childNodes).map(visit).join('');
      if (!content) {
        return '';
      }

      return blockTags.has(tag) ? `\n${content}\n` : content;
    }

    return cleanupMarkdown(visit(node));
  }

  function extractSnapshotContent(snapshot) {
    const roots = getTopLevelExportRoots(snapshot);
    const blocks = roots.map((root) => {
      const clone = root.cloneNode(true);
      sanitizeExportRoot(clone);
      const markdown = cleanupMarkdown(serializeNode(clone, { depth: 0 }));
      if (markdown) {
        return markdown;
      }
      return extractPlainText(clone);
    }).filter(Boolean);

    if (blocks.length) {
      return cleanupMarkdown(blocks.join('\n\n'));
    }

    return '';
  }

  function extractSnapshotText(snapshot) {
    const roots = getTopLevelExportRoots(snapshot);
    const blocks = roots.map((root) => {
      const clone = root.cloneNode(true);
      sanitizeExportRoot(clone);
      const text = extractPlainMessageText(clone);
      if (text) {
        return text;
      }
      return cleanInlineText(clone.textContent || '');
    }).filter(Boolean);

    if (blocks.length) {
      return cleanupMarkdown(blocks.join('\n\n'));
    }

    return '';
  }

  function getConversationTitle() {
    const title = document.title
      .replace(/\s*-\s*ChatGPT.*$/i, '')
      .replace(/\s*\|\s*ChatGPT.*$/i, '')
      .trim();

    return title || 'ChatGPT Chat Export';
  }

  function buildFilename(extension = 'md') {
    const base = getConversationTitle()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
      .replace(/[. ]+$/g, '')
      .trim();
    const safeBase = base || 'ChatGPT Chat Export';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `${safeBase} ${timestamp}.${extension}`;
  }

  function triggerDownload(filename, text, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportConversationAsMarkdown() {
    const articles = getArticles();
    if (!articles.length) {
      throw new Error('No conversation messages found.');
    }

    const lines = [
      `# ${getConversationTitle()}`,
      '',
      `- Exported: ${new Date().toLocaleString()}`,
      `- Source: ${location.href}`,
      `- Messages: ${articles.length}`,
      '',
    ];

    articles.forEach((article, index) => {
      const snapshot = createArticleSnapshot(article);
      const snapshotRole = snapshot.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role');
      const role = snapshotRole ? normalizeRole(snapshotRole) : getArticleRole(article);
      const content = extractSnapshotContent(snapshot) || '_No text extracted._';

      lines.push(`## ${index + 1}. ${role}`);
      lines.push('');
      lines.push(content);
      lines.push('');
    });

    const markdown = cleanupMarkdown(lines.join('\n')) + '\n';
    const filename = buildFilename('md');
    triggerDownload(filename, markdown, 'text/markdown;charset=utf-8');
    return filename;
  }

  function exportConversationAsJsonl() {
    const articles = getArticles();
    if (!articles.length) {
      throw new Error('No conversation messages found.');
    }

    const jsonl = articles.map((article) => {
      const snapshot = createArticleSnapshot(article);
      const snapshotRole = snapshot.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role');
      const role = snapshotRole ? normalizeJsonlRole(snapshotRole) : getArticleRawRole(article);
      const text = extractSnapshotText(snapshot) || '';
      return JSON.stringify({ role, text });
    }).join('\n') + '\n';

    const filename = buildFilename('jsonl');
    triggerDownload(filename, jsonl, 'application/x-ndjson;charset=utf-8');
    return filename;
  }

  async function handleMarkdownExportAction() {
    closeMenu();
    flashTriggerState('busy', 0);

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    try {
      exportConversationAsMarkdown();
      flashTriggerState('done', 1200);
    } catch (error) {
      console.error('[Thread Toolkit] Markdown export failed.', error);
      flashTriggerState('error', 1600);
    }
  }

  async function handleJsonlExportAction() {
    closeMenu();
    flashTriggerState('busy', 0);

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    try {
      exportConversationAsJsonl();
      flashTriggerState('done', 1200);
    } catch (error) {
      console.error('[Thread Toolkit] JSONL export failed.', error);
      flashTriggerState('error', 1600);
    }
  }

  function installObservers() {
    const observer = new MutationObserver(() => {
      schedulePanelRefresh();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener('pointerdown', (event) => {
      if (!panel || panel.contains(event.target)) {
        return;
      }
      closeMenu();
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    });

    window.addEventListener('resize', closeMenu);
    window.addEventListener('popstate', schedulePanelRefresh);
  }

  async function bootstrap() {
    await initializeAutoCollapseStorage();
    injectStyles();
    ensurePanel();
    installObservers();
    installStorageSyncListener();
    schedulePanelRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void bootstrap();
    }, { once: true });
  } else {
    void bootstrap();
  }
})();
