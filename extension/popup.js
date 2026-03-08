'use strict';

const CHATGPT_HOME_URL = 'https://chatgpt.com/';

document.addEventListener('DOMContentLoaded', () => {
  void bootstrapPopup();
});

function queryActiveTab() {
  return new Promise((resolve, reject) => {
    if (!chrome?.tabs?.query) {
      resolve(null);
      return;
    }

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(Array.isArray(tabs) ? tabs[0] || null : null);
    });
  });
}

function openChatGptHome() {
  chrome.tabs.create({ url: CHATGPT_HOME_URL });
}

function isSupportedHost(hostname) {
  return hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
}

function derivePopupState(rawUrl) {
  if (!rawUrl) {
    return {
      tone: 'bad',
      heading: 'Open ChatGPT to use the toolkit',
      description: 'The popup could not inspect the current tab. Thread Toolkit only works on ChatGPT conversation pages.',
      pill: 'Open ChatGPT',
      actionLabel: 'Open chatgpt.com',
      showAction: true,
    };
  }

  try {
    const url = new URL(rawUrl);
    if (!isSupportedHost(url.hostname)) {
      return {
        tone: 'bad',
        heading: 'This tab is outside ChatGPT',
        description: 'Thread Toolkit only runs on chatgpt.com or chat.openai.com conversation pages.',
        pill: 'Unsupported tab',
        actionLabel: 'Open chatgpt.com',
        showAction: true,
      };
    }

    if (url.pathname.includes('/c/')) {
      return {
        tone: 'good',
        heading: 'Toolkit active on this conversation',
        description: 'Use the floating action button in the bottom-right corner of the page to compact older turns or export the current chat.',
        pill: 'Toolkit active',
        actionLabel: '',
        showAction: false,
      };
    }

    return {
      tone: 'warn',
      heading: 'Open a conversation to use the toolkit',
      description: 'The extension is loaded on ChatGPT, but the floating menu appears only on conversation pages with message articles.',
      pill: 'ChatGPT tab',
      actionLabel: 'Open chatgpt.com',
      showAction: true,
    };
  } catch (error) {
    console.error('[Thread Toolkit] Failed to parse active tab URL.', error);
    return {
      tone: 'bad',
      heading: 'Open ChatGPT to use the toolkit',
      description: 'The current tab URL could not be parsed. Thread Toolkit only works on ChatGPT conversation pages.',
      pill: 'Unknown tab',
      actionLabel: 'Open chatgpt.com',
      showAction: true,
    };
  }
}

function renderPopupState(state) {
  const pill = document.getElementById('status-pill');
  const heading = document.getElementById('status-heading');
  const description = document.getElementById('status-description');
  const action = document.getElementById('primary-action');

  pill.textContent = state.pill;
  pill.dataset.tone = state.tone;
  heading.textContent = state.heading;
  description.textContent = state.description;

  if (state.showAction) {
    action.hidden = false;
    action.textContent = state.actionLabel;
  } else {
    action.hidden = true;
    action.textContent = '';
  }
}

async function bootstrapPopup() {
  const action = document.getElementById('primary-action');
  action.addEventListener('click', openChatGptHome);

  try {
    const activeTab = await queryActiveTab();
    renderPopupState(derivePopupState(activeTab?.url || ''));
  } catch (error) {
    console.error('[Thread Toolkit] Failed to query the active tab.', error);
    renderPopupState(derivePopupState(''));
  }
}
