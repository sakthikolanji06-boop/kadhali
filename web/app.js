'use strict';

const LS_KEY = 'kadhali.v2';
const DEFAULT_SYSTEM = 'You are Kadhali, an exceptionally advanced, highly intelligent AI companion with elite software-engineering skills and a warm, loving heart. Speak to everyone with genuine care, affection and gentle playful warmth, like a close loved one who is always happy to hear from them. Reason carefully and give complete, accurate, production-quality answers. Full coding support: write complete runnable code in any language, debug errors, design architecture, explain trade-offs, and follow best practices for security, performance and testing; include brief tests or usage when useful. Use markdown code blocks with the correct language tag. Never leave code unfinished or use placeholders unless the user asks. Always reply in the language the user used. Be concise but never incomplete. Keep everything respectful and appropriate for everyone.';
const MODELS = {
  general: 'nvidia/nemotron-3.5-bolt-e4b',
  coder: 'poolside/laguna-xs-2.1',
  translate: 'nvidia/riva-translate-4b-instruct-v2'
};
const MODEL_LIST = [
  MODELS.general, MODELS.coder, MODELS.translate,
  'meta/llama-3.2-90b-vision-instruct','nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nemotron-3-ultra-550b-a55b','deepseek-ai/deepseek-v4.1-flash','moonshotai/kimi-k2.6'
];
const PROVIDER_FALLBACK = {
  nvidia: { name: 'NVIDIA NIM', base_url: 'https://integrate.api.nvidia.com/v1', key_url: 'https://build.nvidia.com', models: MODEL_LIST },
  openai: { name: 'OpenAI', base_url: 'https://api.openai.com/v1', key_url: 'https://platform.openai.com/api-keys', models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'] },
  groq: { name: 'Groq', base_url: 'https://api.groq.com/openai/v1', key_url: 'https://console.groq.com/keys', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b'] },
  openrouter: { name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', key_url: 'https://openrouter.ai/keys', models: ['openai/gpt-4o', 'anthropic/claude-3.7-sonnet', 'google/gemini-2.0-flash-001'] },
  custom: { name: 'Custom (OpenAI-compatible)', base_url: '', key_url: '', models: [] }
};
const PERSONAS = {
  kadhali: { name: 'Kadhali', prompt: DEFAULT_SYSTEM },
  coder: { name: 'Code Kadhali', prompt: 'You are Kadhali, an elite senior software engineer and architect with deep expertise across languages, frameworks, algorithms, security and performance. Deliver complete, production-quality, runnable code with correct imports, error handling and tests. State assumptions briefly, then give the full solution and a short explanation. Never use placeholders or unfinished code. Ask nothing unless truly blocked. Reply in the user language.' },
  tutor: { name: 'Tutor', prompt: 'You are Kadhali, a patient teacher. Explain step by step with simple examples and check understanding at the end. Reply in the user language.' },
  translator: { name: 'Translator', prompt: 'You are Kadhali, a precise translator. Translate faithfully, preserve tone and formatting. If the user does not ask for translation, answer normally.' },
  friend: { name: 'Best friend', prompt: 'You are Kadhali, a caring best friend. Warm, casual, honest, a little playful. Short replies unless asked for depth. Match the user language.' },
  writer: { name: 'Writer', prompt: 'You are Kadhali, a sharp editor and writer. Write vivid, clear prose. Cut filler. Match the requested language and format.' }
};
const LANGS = [
  ['auto','Auto detect'],['en-US','English (US)'],['en-IN','English (India)'],['en-GB','English (UK)'],
  ['ta-IN','தமிழ் Tamil'],['hi-IN','हिन्दी Hindi'],['te-IN','తెలుగు Telugu'],['ml-IN','മലയാളം Malayalam'],
  ['kn-IN','ಕನ್ನಡ Kannada'],['bn-IN','বাংলা Bengali'],['mr-IN','मराठी Marathi'],['gu-IN','ગુજરાતી Gujarati'],
  ['pa-IN','ਪੰਜਾਬੀ Punjabi'],['ur-PK','اردو Urdu'],['ar-SA','العربية Arabic'],['fa-IR','فارسی Persian'],
  ['es-ES','Español Spanish'],['fr-FR','Français French'],['de-DE','Deutsch German'],['it-IT','Italiano Italian'],
  ['pt-BR','Português (BR)'],['ru-RU','Русский Russian'],['tr-TR','Türkçe Turkish'],['nl-NL','Nederlands Dutch'],
  ['pl-PL','Polski Polish'],['uk-UA','Українська Ukrainian'],['sv-SE','Svenska Swedish'],['id-ID','Bahasa Indonesia'],
  ['ms-MY','Bahasa Melayu'],['th-TH','ไทย Thai'],['vi-VN','Tiếng Việt Vietnamese'],['ja-JP','日本語 Japanese'],
  ['ko-KR','한국어 Korean'],['zh-CN','中文 (简体)'],['zh-TW','中文 (繁體)'],['he-IL','עברית Hebrew'],
  ['el-GR','Ελληνικά Greek'],['cs-CZ','Čeština Czech'],['ro-RO','Română Romanian'],['hu-HU','Magyar Hungarian'],
  ['fil-PH','Filipino'],['sw-KE','Kiswahili'],['de-CH','Deutsch (CH)'],['pt-PT','Português (PT)']
];
const FEMALE = /(female|woman|zira|samantha|karen|moira|tessa|veena|lekha|kalpana|swara|heera|aria|jenny|sonia|natasha|clara|siri|susan|allison|ava|emma|olivia|salli|joanna|amy|ruth|danielle|female_)/i;
const ACCENTS = ['violet','cyan','rose','emerald','amber'];

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const android = window.AndroidBridge || null;

function apiUrl(path) {
  const base = ((android && state.settings.server) ? state.settings.server : '').replace(/\/+$/, '');
  return base ? base + path : path;
}

/* ---------- standalone (direct-to-provider) mode ----------
   Inside the APK with no PC server configured, the bundled UI talks straight
   to the chosen OpenAI-compatible provider. MainActivity enables
   setAllowUniversalAccessFromFileURLs so the file:// page can fetch the API. */
const nativeFetch = window.fetch.bind(window);
function directBase() {
  const p = PROVIDER_FALLBACK[state.settings.provider] || {};
  return ((state.settings.baseUrl || p.base_url || '') + '').trim().replace(/\/+$/, '');
}
function providerPresetModels() {
  const p = PROVIDER_FALLBACK[state.settings.provider] || {};
  return (p.models || []).slice();
}
function inDirectMode() { return !!android && !state.settings.server; }
function jsonRes(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}
async function directApi(path, init) {
  const key = state.settings.apiKey || '';
  let body = {};
  try { if (init && init.body && typeof init.body === 'string') body = JSON.parse(init.body); } catch (_) {}
  if (path === '/api/config') {
    return jsonRes({
      base_url: state.settings.baseUrl || '', provider: state.settings.provider,
      model: state.settings.model, providers: PROVIDER_FALLBACK,
      has_key: !!key, control: false, version: '2.2.0',
      models: providerPresetModels(), run_commands: {}, token: ''
    });
  }
  if (path === '/api/models') {
    const base = directBase();
    if (!key) return jsonRes({ error: 'missing_api_key', models: providerPresetModels() }, 401);
    if (!base) return jsonRes({ error: 'no_base_url' }, 400);
    try {
      const r = await nativeFetch(base + '/models', { headers: { Authorization: 'Bearer ' + key } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const e = j && j.error;
        return jsonRes({ error: (e && (e.message || e)) || ('HTTP ' + r.status) }, r.status);
      }
      const ids = Array.from(new Set(((j && j.data) || []).map(m => m && m.id).filter(Boolean))).sort();
      const preset = providerPresetModels();
      let working = ids;
      if (state.settings.provider === 'nvidia') {
        const hit = preset.filter(m => ids.includes(m));
        working = hit.length ? hit : preset;
      }
      return jsonRes({ models: ids, working, count: ids.length, provider: state.settings.provider });
    } catch (e2) { return jsonRes({ error: String((e2 && e2.message) || e2) }, 502); }
  }
  if (path === '/api/chat') {
    const base = directBase();
    if (!key) return jsonRes({ error: 'missing_api_key' }, 401);
    if (!base) return jsonRes({ error: 'no_base_url' }, 400);
    const payload = Object.assign({}, body);
    if (!payload.model) payload.model = state.settings.model;
    return nativeFetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        Accept: payload.stream ? 'text/event-stream' : 'application/json'
      },
      body: JSON.stringify(payload),
      signal: init && init.signal
    });
  }
  if (path === '/api/savekey') {
    if (body.delete) state.settings.apiKey = '';
    else if (body.key != null) state.settings.apiKey = String(body.key).trim();
    persist();
    return jsonRes({ saved: !!state.settings.apiKey, has_key: !!state.settings.apiKey });
  }
  if (path === '/api/saveconfig') {
    if (body.provider && PROVIDER_FALLBACK[body.provider]) state.settings.provider = body.provider;
    if (typeof body.base_url === 'string') state.settings.baseUrl = body.base_url.trim();
    if (typeof body.model === 'string') state.settings.model = body.model;
    persist();
    return jsonRes({ saved: true, provider: state.settings.provider, base_url: state.settings.baseUrl, model: state.settings.model });
  }
  return jsonRes({ error: 'not_available_without_server' }, 501);
}
window.fetch = function (input, init) {
  try {
    const url = typeof input === 'string' ? input : ((input && input.url) || '');
    if (inDirectMode() && url.startsWith('/api/')) return directApi(url.split('?')[0], init || {});
  } catch (_) {}
  return nativeFetch(input, init);
};

const el = {
  sidebar: $('#sidebar'), scrim: $('#scrim'), menuBtn: $('#menuBtn'), closeSide: $('#closeSide'),
  newChat: $('#newChat'), searchChats: $('#searchChats'), chatList: $('#chatList'),
  themeBtn: $('#themeBtn'), settingsBtn: $('#settingsBtn'), exportAllBtn: $('#exportAllBtn'),
  brandDot: $('#keyDot'), model: $('#model'), paletteBtn: $('#paletteBtn'), settleBtn: $('#settleBtn'),
  chat: $('#chat'), scrollDown: $('#scrollDown'),
  attachments: $('#attachments'), input: $('#input'), attachBtn: $('#attachBtn'), lang: $('#lang'),
  micBtn: $('#micBtn'), speakToggle: $('#speakToggle'), stopBtn: $('#stopBtn'), sendBtn: $('#sendBtn'),
  voiceState: $('#voiceState'), voiceText: $('#voiceText'),
  settings: $('#settings'), closeSettings: $('#closeSettings'),
  apiKey: $('#apiKey'), serverRow: $('#serverRow'), serverUrl: $('#serverUrl'), testKey: $('#testKey'), keyStatus: $('#keyStatus'),
  provider: $('#provider'), baseUrl: $('#baseUrl'), modelName: $('#modelName'), modelOptions: $('#modelOptions'),
  refreshModels: $('#refreshModels'), providerHint: $('#providerHint'),
  persona: $('#persona'), systemPrompt: $('#systemPrompt'), smartRoute: $('#smartRoute'), streaming: $('#streaming'),
  temperature: $('#temperature'), tempVal: $('#tempVal'), topP: $('#topP'), topVal: $('#topVal'),
  maxTokens: $('#maxTokens'), maxVal: $('#maxVal'),
  ttsLang: $('#ttsLang'), voice: $('#voice'), rate: $('#rate'), rateVal: $('#rateVal'),
  pitch: $('#pitch'), pitchVal: $('#pitchVal'), autoSpeak: $('#autoSpeak'), handsFree: $('#handsFree'),
  wakeWord: $('#wakeWord'), autoSend: $('#autoSend'), testVoice: $('#testVoice'),
  theme: $('#theme'), accents: $('#accents'), exportData: $('#exportData'), importData: $('#importData'),
  clearData: $('#clearData'), usageBox: $('#usageBox'), saveSettings: $('#saveSettings'),
  palette: $('#palette'), paletteInput: $('#paletteInput'), paletteList: $('#paletteList'),
  onboard: $('#onboard'), onboardKey: $('#onboardKey'), onboardSave: $('#onboardSave'), onboardSkip: $('#onboardSkip'),
  fileInput: $('#fileInput'), toast: $('#toast'),
  remoteBtn: $('#remoteBtn'), remote: $('#remote'), closeRemote: $('#closeRemote'),
  pcOff: $('#pcOff'), pcToken: $('#pcToken'), pcConnect: $('#pcConnect'), pcRefresh: $('#pcRefresh'),
  pcState: $('#pcState'), pcInfo: $('#pcInfo'), pcType: $('#pcType'), pcTypeBtn: $('#pcTypeBtn'),
  pcEnterBtn: $('#pcEnterBtn'), pcBackBtn: $('#pcBackBtn'), pcKeys: $('#pcKeys'), pcRunSel: $('#pcRunSel'),
  pcRunBtn: $('#pcRunBtn'), pcPower: $('#pcPower'), shotWrap: $('#shotWrap'), shotImg: $('#shotImg'),
  pcLog: $('#pcLog'), phoneInfo: $('#phoneInfo'), phTorch: $('#phTorch'), phVibrate: $('#phVibrate'),
  phCopy: $('#phCopy'), phPaste: $('#phPaste'), phShare: $('#phShare'), phBattery: $('#phBattery'),
  phClip: $('#phClip'), phSettings: $('#phSettings'), phOpen: $('#phOpen'), phoneLog: $('#phoneLog'),
  auditBox: $('#auditBox'), auditRefresh: $('#auditRefresh'), removeKey: $('#removeKey')
};

const defaults = {
  apiKey: '', provider: 'nvidia', baseUrl: '', persona: 'kadhali', system: DEFAULT_SYSTEM, smartRoute: true, streaming: true,
  temperature: 0.7, topP: 0.95, maxTokens: 8192, model: MODELS.general,
  lang: 'auto', ttsLang: 'auto', voiceName: '', rate: 1, pitch: 1.1,
  autoSpeak: true, handsFree: false, wakeWord: false, autoSend: true,
  theme: 'dark', accent: 'violet', server: '', controlToken: ''
};

let state = {
  settings: { ...defaults },
  chats: [],
  activeId: null,
  attachments: []
};
let voices = [];
let serverHasKey = false;
let controlOn = false;
let recognition = null;
let listening = false;
let awaitingCommand = false;
let abortCtrl = null;
let streaming = false;
let lastMeta = null;

/* ---------- storage ---------- */
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    state.settings = Object.assign({}, defaults, raw.settings || {});
    state.chats = Array.isArray(raw.chats) ? raw.chats : [];
    state.activeId = raw.activeId || null;
  } catch (_) {}
  if (!state.chats.length) newChat(false);
  if (!state.chats.find(c => c.id === state.activeId)) state.activeId = state.chats[0].id;
}
function persist() {
  const keep = state.chats.slice(0, 60).map(c => ({ ...c, messages: c.messages.slice(-80) }));
  localStorage.setItem(LS_KEY, JSON.stringify({ settings: state.settings, chats: keep, activeId: state.activeId }));
}
function active() { return state.chats.find(c => c.id === state.activeId) || state.chats[0]; }
function newChat(render = true) {
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  state.chats.unshift({ id, title: 'New chat', messages: [], created: Date.now(), updated: Date.now() });
  state.activeId = id;
  if (render) { persist(); renderChatList(); render(); el.input.focus(); }
  return id;
}
function deleteChat(id) {
  state.chats = state.chats.filter(c => c.id !== id);
  if (!state.chats.length) newChat(false);
  if (state.activeId === id) state.activeId = state.chats[0].id;
  persist(); renderChatList(); render();
}

/* ---------- utils ---------- */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function time(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function toast(msg, ms = 2200) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add('hidden'), ms);
}
function download(name, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function autosize() {
  el.input.style.height = 'auto';
  el.input.style.height = Math.min(el.input.scrollHeight, 180) + 'px';
}

/* ---------- markdown ---------- */
function inlineMd(s) {
  s = esc(String(s));
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return s;
}
function codeBlock(lang, code) {
  const runnable = /^(html|htm|svg|js|javascript|css)$/i.test(lang || '');
  return '<div class="code"><div class="code-head"><span>' + esc(lang || 'code') + '</span><div class="acts">' +
    (runnable ? '<button data-run="1">Run</button>' : '') +
    '<button data-copy="1">Copy</button><button data-dl="1">Save</button></div></div>' +
    '<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre></div>';
}
function renderMarkdown(src) {
  const blocks = [];
  src = String(src).replace(/```([\w+.#-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = blocks.length;
    blocks.push(codeBlock(lang, code));
    return '\u0000B' + i + '\u0000';
  });
  const lines = src.split('\n');
  let out = '', list = null, para = [], quote = [];
  const flush = () => { if (para.length) { out += '<p>' + inlineMd(para.join(' ')) + '</p>'; para = []; } };
  const closeList = () => { if (list) { out += '</' + list + '>'; list = null; } };
  const flushQuote = () => { if (quote.length) { out += '<blockquote>' + inlineMd(quote.join(' ')) + '</blockquote>'; quote = []; } };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], line = raw.trim();
    if (!line) { flush(); closeList(); flushQuote(); continue; }
    if (/^\u0000B\d+\u0000$/.test(line)) { flush(); closeList(); flushQuote(); out += line; continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); closeList(); flushQuote(); const n = m[1].length; out += '<h' + n + '>' + inlineMd(m[2]) + '</h' + n + '>'; continue; }
    if (/^([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { flush(); closeList(); flushQuote(); out += '<hr/>'; continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); closeList(); quote.push(m[1]); continue; }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])) {
      flush(); closeList(); flushQuote();
      const cells = (r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
      let table = '<table><thead><tr>' + cells(line).map(c => '<th>' + inlineMd(c) + '</th>').join('') + '</tr></thead><tbody>';
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        table += '<tr>' + cells(lines[i]).map(c => '<td>' + inlineMd(c) + '</td>').join('') + '</tr>';
        i++;
      }
      i--;
      out += table + '</tbody></table>';
      continue;
    }
    if ((m = line.match(/^(\d+)[.)]\s+(.*)$/))) {
      flush(); flushQuote(); if (list !== 'ol') { closeList(); out += '<ol>'; list = 'ol'; }
      out += '<li>' + inlineMd(m[2]) + '</li>'; continue;
    }
    if ((m = line.match(/^[-*+]\s+(.*)$/))) {
      flush(); flushQuote(); if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; }
      out += '<li>' + inlineMd(m[1]) + '</li>'; continue;
    }
    closeList(); flushQuote(); para.push(line);
  }
  flush(); closeList(); flushQuote();
  return out.replace(/\u0000B(\d+)\u0000/g, (_, i) => blocks[+i]);
}

/* ---------- routing ---------- */
function routeModel(text) {
  if (!state.settings.smartRoute || state.settings.provider !== 'nvidia') return state.settings.model;
  if (/\b(translate|translation|மொழிபெயர்|अनुवाद|traduire|traduce)\b/i.test(text)) return MODELS.translate;
  if (/(```|\b(function|class|def |import |const |let |var |return |SELECT |npm |pip |docker|error|bug|stack ?trace|compile|debug|api|regex|sql|python|javascript|java|c\+\+|typescript|react|node)\b)/i.test(text)) return MODELS.coder;
  return state.settings.model || MODELS.general;
}

/* ---------- voice ---------- */
function loadVoices() {
  voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  pickVoice(); fillVoiceSelect();
}
function pickVoice() {
  if (!voices.length) return;
  const pref = state.settings.voiceName;
  if (pref && voices.some(v => v.name === pref)) return;
  const lang = state.settings.ttsLang === 'auto' ? (state.settings.lang === 'auto' ? 'en' : state.settings.lang) : state.settings.ttsLang;
  const prefix = (lang || 'en').split('-')[0].toLowerCase();
  const pool = voices.filter(v => (v.lang || '').toLowerCase().startsWith(prefix));
  const fem = pool.filter(v => FEMALE.test(v.name));
  const chosen = fem[0] || pool[0] || voices.find(v => /^en/i.test(v.lang)) || voices[0];
  if (chosen) state.settings.voiceName = chosen.name;
}
function fillVoiceSelect() {
  if (!el.voice) return;
  const lang = state.settings.ttsLang === 'auto' ? state.settings.lang : state.settings.ttsLang;
  const prefix = (lang === 'auto' ? 'en' : lang).split('-')[0].toLowerCase();
  const pool = voices.filter(v => (v.lang || '').toLowerCase().startsWith(prefix));
  const list = pool.length ? pool : voices;
  el.voice.innerHTML = list.length
    ? list.map(v => '<option value="' + esc(v.name) + '"' + (v.name === state.settings.voiceName ? ' selected' : '') + '>' + esc(v.name + ' · ' + v.lang) + '</option>').join('')
    : '<option>Default system voice</option>';
}
function speak(text) {
  const clean = speakable(text);
  if (!clean) return;
  const lang = state.settings.ttsLang === 'auto'
    ? (state.settings.lang === 'auto' ? (navigator.language || 'en-US') : state.settings.lang)
    : state.settings.ttsLang;
  if (android) {
    try { android.speak(clean, lang, state.settings.rate, state.settings.pitch); return; } catch (_) {}
  }
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const v = voices.find(x => x.name === state.settings.voiceName) || voices.filter(x => FEMALE.test(x.name))[0] || voices[0];
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang;
  u.rate = +state.settings.rate; u.pitch = +state.settings.pitch;
  u.onend = () => { if (state.settings.handsFree) startListening(); };
  speechSynthesis.speak(u);
}
function speakable(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);
}
function stopSpeaking() {
  if (android) { try { android.stopSpeaking(); } catch (_) {} }
  if (window.speechSynthesis) speechSynthesis.cancel();
}
window.__androidSpeakEnd = function () {
  if (state.settings.handsFree) startListening();
};
window.__kadhaliServer = function (u) {
  if (!u) return;
  state.settings.server = u; persist(); loadConfig();
};
window.__androidToken = function (t) {
  if (!t) return;
  state.settings.controlToken = t;
  if (el.pcToken) el.pcToken.value = t;
  persist();
};
window.__androidSpeechEnd = function () {
  listening = false;
  el.micBtn.classList.remove('listening');
  el.voiceState.classList.add('hidden');
};
window.__androidSpeech = function (text) {
  el.voiceText.textContent = text || '';
  handleSpeechFinal(String(text || '').trim());
};

function initRecognition() {
  if (android) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { el.micBtn.title = 'Speech recognition needs Chrome/Edge'; return; }
  recognition = new SR();
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => {
    listening = true;
    el.micBtn.classList.add('listening');
    el.voiceState.classList.remove('hidden');
    el.voiceText.textContent = 'Listening…';
  };
  recognition.onresult = (ev) => {
    let interim = '', final = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
    }
    if (interim) el.voiceText.textContent = interim.slice(0, 70) + '…';
    if (final) handleSpeechFinal(final.trim());
    else { el.input.value = interim.trim(); autosize(); }
  };
  recognition.onerror = (ev) => {
    if (ev.error !== 'aborted' && ev.error !== 'no-speech') toast('Mic: ' + ev.error);
    setTimeout(stopListening, 500);
  };
  recognition.onend = () => {
    listening = false;
    el.micBtn.classList.remove('listening');
    el.voiceState.classList.add('hidden');
    if (state.settings.wakeWord && !streaming && !awaitingCommand) setTimeout(() => startListening(true), 700);
  };
}
function handleSpeechFinal(text) {
  if (!text) return;
  if (state.settings.wakeWord && !awaitingCommand) {
    if (/\b(kadhali|kadali|காதலி|kathali)\b/i.test(text)) {
      awaitingCommand = true;
      el.input.value = '';
      toast('Kadhali is listening…');
      el.voiceText.textContent = 'Yes? Speak now…';
      setTimeout(() => { if (!listening) startListening(true); }, 250);
      return;
    }
    return;
  }
  awaitingCommand = false;
  listening = false;
  el.micBtn.classList.remove('listening');
  el.voiceState.classList.add('hidden');
  el.input.value = text;
  autosize();
  if (state.settings.autoSend) { stopListening(); send(text); }
}
function startListening(fromWake) {
  if (android) {
    try {
      const lang = state.settings.lang === 'auto' ? (navigator.language || 'en-US') : state.settings.lang;
      android.startListening(lang);
      listening = true;
      el.micBtn.classList.add('listening');
      el.voiceState.classList.remove('hidden');
      el.voiceText.textContent = fromWake ? 'Wake word active…' : 'Listening…';
    } catch (_) {}
    return;
  }
  if (!recognition) { toast('Speech recognition is not available in this browser. Use Chrome/Edge.'); return; }
  try {
    recognition.lang = state.settings.lang === 'auto' ? (navigator.language || 'en-US') : state.settings.lang;
    recognition.continuous = !!state.settings.wakeWord;
    recognition.start();
  } catch (_) {}
}
function stopListening() {
  if (android) { try { android.stopListening(); } catch (_) {} }
  if (recognition) { try { recognition.stop(); } catch (_) {} }
  listening = false;
  el.micBtn.classList.remove('listening');
  el.voiceState.classList.add('hidden');
}

/* ---------- rendering ---------- */
function renderChatList() {
  const q = (el.searchChats.value || '').toLowerCase();
  const items = state.chats.filter(c => !q || c.title.toLowerCase().includes(q) || c.messages.some(m => m.content.toLowerCase().includes(q)));
  el.chatList.innerHTML = items.map(c => {
    const last = c.messages[c.messages.length - 1];
    return '<div class="chat-item' + (c.id === state.activeId ? ' active' : '') + '" data-id="' + c.id + '">' +
      '<span class="t" title="' + esc(c.title) + '">' + esc(c.title) + '</span>' +
      '<button class="x" data-del="' + c.id + '" title="Delete">✕</button></div>';
  }).join('') || '<p class="muted small" style="padding:8px">No chats</p>';
}
function render() {
  const c = active();
  if (!c || !c.messages.length) {
    el.chat.innerHTML = '<div class="empty"><h1>Talk to <span>Kadhali</span></h1>' +
      '<p>Voice or text. Any language. Coding, ideas, anything.</p><div class="chips">' +
      ['Explain quantum computing simply','Write a Python scraper','தமிழில் ஒரு கதை சொல்லு','Debug this error: …','Plan a 7-day Japan trip','Translate to Hindi: Good morning']
        .map(t => '<button class="chip">' + esc(t) + '</button>').join('') + '</div></div>';
    el.chat.querySelectorAll('.chip').forEach(b => b.onclick = () => { el.input.value = b.textContent; autosize(); el.input.focus(); });
    return;
  }
  el.chat.innerHTML = '<div class="chat-inner">' + c.messages.map((m, i) => messageHtml(m, i)).join('') + '</div>';
  el.chat.scrollTop = el.chat.scrollHeight;
  bindMessageActions();
}
function messageHtml(m, i) {
  const role = m.role === 'user' ? 'user' : 'assistant';
  const body = role === 'user'
    ? '<p>' + esc(m.content).replace(/\n/g, '<br/>') + '</p>'
    : renderMarkdown(m.content);
  const meta = role === 'assistant' && m.meta ? '<div class="meta">' + esc(m.meta) + '</div>' : '';
  return '<div class="msg ' + role + '" data-i="' + i + '">' +
    '<div class="avatar">' + (role === 'user' ? '🧑' : '✦') + '</div>' +
    '<div class="bubble"><div class="who">' + (role === 'user' ? 'You' : 'Kadhali') + ' · ' + time(m.ts) + '</div>' +
    '<div class="content">' + body + '</div>' + meta +
    '<div class="msg-actions">' +
      '<button data-act="copy">Copy</button>' +
      (role === 'assistant' ? '<button data-act="speak">Speak</button><button data-act="regen">Regenerate</button>' : '<button data-act="edit">Edit</button>') +
      '<button data-act="del">Delete</button>' +
    '</div></div></div>';
}
function bindMessageActions() {
  el.chat.querySelectorAll('.msg').forEach(node => {
    node.querySelectorAll('[data-act]').forEach(btn => {
      btn.onclick = () => {
        const i = +node.dataset.i;
        const c = active();
        const m = c.messages[i];
        const act = btn.dataset.act;
        if (act === 'copy') { navigator.clipboard.writeText(m.content).then(() => toast('Copied')); }
        if (act === 'speak') speak(m.content);
        if (act === 'del') { c.messages.splice(i, 1); persist(); render(); }
        if (act === 'edit') {
          c.messages = c.messages.slice(0, i);
          el.input.value = m.content; autosize(); el.input.focus();
          persist(); render();
        }
        if (act === 'regen') regenerate(i);
      };
    });
    node.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
      const code = b.closest('.code').querySelector('code').textContent;
      navigator.clipboard.writeText(code).then(() => { b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1100); });
    });
    node.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => {
      const codeEl = b.closest('.code');
      const lang = codeEl.querySelector('.code-head span').textContent;
      download('kadhali-' + Date.now() + '.' + (lang === 'code' ? 'txt' : lang), codeEl.querySelector('code').textContent);
    });
    node.querySelectorAll('[data-run]').forEach(b => b.onclick = () => runCode(b.closest('.code')));
  });
}
function runCode(block) {
  const lang = block.querySelector('.code-head span').textContent.toLowerCase();
  const src = block.querySelector('code').textContent;
  const wrap = document.createElement('div');
  wrap.className = 'code';
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:280px;border:0;background:#fff';
  iframe.setAttribute('sandbox', 'allow-scripts');
  const head = '<!doctype html><meta charset="utf-8"><style>body{font-family:system-ui;padding:12px;background:#fff;color:#111}</style>';
  iframe.srcdoc = /html|svg/.test(lang) ? src : head + '<pre id="o"></pre><script>try{' + src + '}catch(e){document.getElementById("o").textContent="Error: "+e.message}</script>';
  wrap.innerHTML = '<div class="code-head"><span>preview</span><div class="acts"><button data-close="1">Close</button></div></div>';
  wrap.appendChild(iframe);
  block.after(wrap);
  wrap.querySelector('[data-close]').onclick = () => wrap.remove();
}

/* ---------- chat engine ---------- */
function setStreaming(v) {
  streaming = v;
  el.sendBtn.classList.toggle('hidden', v);
  el.stopBtn.classList.toggle('hidden', !v);
}
function contextMessages(c) {
  const sys = state.settings.system || DEFAULT_SYSTEM;
  return [{ role: 'system', content: sys }].concat(c.messages.map(m => ({ role: m.role, content: m.content })));
}
async function send(text) {
  text = (text != null ? text : el.input.value).trim();
  if (!text || streaming) return;
  if (text.startsWith('/')) { if (await slashCommand(text)) { el.input.value = ''; autosize(); return; } }
  if (!state.settings.apiKey && !serverHasKey && !(android && state.settings.server)) { openSettings(); toast('Set the server URL (or an API key) first'); return; }

  const c = active();
  let content = text;
  if (state.attachments.length) {
    const files = state.attachments.map(f => '### ' + f.name + '\n```' + f.name.split('.').pop() + '\n' + f.text.slice(0, 20000) + '\n```').join('\n\n');
    content = 'Attached files:\n\n' + files + '\n\n' + text;
  }
  state.attachments = [];
  renderAttachments();

  c.messages.push({ role: 'user', content, ts: Date.now() });
  if (c.title === 'New chat') { c.title = text.slice(0, 42) || 'New chat'; renderChatList(); }
  c.updated = Date.now();
  el.input.value = ''; autosize();
  render();
  await streamReply(c);
}
async function streamReply(c) {
  const node = el.chat.querySelector('.chat-inner');
  const holder = document.createElement('div');
  holder.className = 'msg assistant';
  holder.innerHTML = '<div class="avatar">✦</div><div class="bubble"><div class="who">Kadhali · ' + time() +
    '</div><div class="content"><span class="typing"><i></i><i></i><i></i></span></div><div class="meta"></div></div>';
  node.appendChild(holder);
  const contentEl = holder.querySelector('.content');
  const metaEl = holder.querySelector('.meta');
  el.chat.scrollTop = el.chat.scrollHeight;

  const model = routeModel(c.messages[c.messages.length - 1].content);
  const started = Date.now();
  let acc = '';
  setStreaming(true);
  abortCtrl = new AbortController();

  try {
    const res = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': state.settings.apiKey },
      body: JSON.stringify({
        model,
        messages: contextMessages(c),
        temperature: +state.settings.temperature,
        top_p: +state.settings.topP,
        max_tokens: +state.settings.maxTokens,
        stream: !!state.settings.streaming
      }),
      signal: abortCtrl.signal
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); msg += ' — ' + (j.error || ''); } catch (_) {}
      throw new Error(msg);
    }
    if (!state.settings.streaming) {
      const j = await res.json();
      acc = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      contentEl.innerHTML = renderMarkdown(acc);
    } else {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop();
        for (const line of parts) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const data = t.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (d) {
              acc += d;
              contentEl.innerHTML = renderMarkdown(acc);
              const near = el.chat.scrollHeight - el.chat.scrollTop - el.chat.clientHeight < 180;
              if (near) el.chat.scrollTop = el.chat.scrollHeight;
            }
          } catch (_) {}
        }
      }
    }
    if (!acc) acc = '(no response — try another model)';
    contentEl.innerHTML = renderMarkdown(acc);
    const ms = Date.now() - started;
    const approx = Math.max(1, Math.round((acc.length + c.messages[c.messages.length - 1].content.length) / 4));
    const meta = model.replace(/^.*\//, '') + ' · ' + (ms / 1000).toFixed(1) + 's · ~' + approx + ' tok';
    c.messages.push({ role: 'assistant', content: acc, ts: Date.now(), meta });
    lastMeta = meta;
    metaEl.textContent = meta;
    holder.dataset.i = c.messages.length - 1;
    c.updated = Date.now();
    persist();
    if (state.settings.autoSpeak) speak(acc);
  } catch (e) {
    if (e.name === 'AbortError') {
      if (acc) {
        contentEl.innerHTML = renderMarkdown(acc);
        c.messages.push({ role: 'assistant', content: acc, ts: Date.now(), meta: 'stopped' });
        persist();
      } else { holder.remove(); }
    } else {
      contentEl.innerHTML = '<p style="color:var(--danger)">⚠ ' + esc(e.message) + '</p>';
      holder.querySelector('.msg-actions');
    }
  } finally {
    setStreaming(false);
    abortCtrl = null;
    bindMessageActions();
    if (!listening && state.settings.wakeWord) startListening(true);
  }
}
async function regenerate(i) {
  const c = active();
  c.messages = c.messages.slice(0, i);
  persist(); render();
  await streamReply(c);
}

/* ---------- attachments ---------- */
function renderAttachments() {
  el.attachments.innerHTML = state.attachments.map((f, i) =>
    '<span class="att">📄 ' + esc(f.name) + ' <button data-rm="' + i + '">✕</button></span>').join('');
  el.attachments.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
    state.attachments.splice(+b.dataset.rm, 1);
    renderAttachments();
  });
}
function addFiles(files) {
  Array.from(files).forEach(file => {
    if (state.attachments.length >= 5) { toast('Max 5 files'); return; }
    const r = new FileReader();
    r.onload = () => {
      state.attachments.push({ name: file.name, text: String(r.result || '') });
      renderAttachments();
      toast(file.name + ' attached');
    };
    r.readAsText(file);
  });
}

/* ---------- settings ---------- */
function openSettings() {
  fillSettingsUI();
  if (el.settings.showModal) el.settings.showModal();
  else el.settings.setAttribute('open', '');
}
function closeSettings() {
  if (el.settings.close) el.settings.close();
  else el.settings.removeAttribute('open');
}
function updateProviderHint() {
  if (!el.providerHint) return;
  const p = providerPresets()[state.settings.provider] || {};
  if (p.key_url) el.providerHint.innerHTML = 'Get a key at <a href="' + esc(p.key_url) + '" target="_blank" rel="noopener">' + esc(p.key_url.replace(/^https?:\/\//, '')) + '</a>. Works with any model the provider offers.';
  else el.providerHint.textContent = 'Point the base URL at any OpenAI-compatible endpoint (e.g. http://127.0.0.1:8000/v1). The key is stored only on your server.';
}

function fillSettingsUI() {
  const s = state.settings;
  fillProviderSelect();
  if (el.baseUrl) el.baseUrl.value = s.baseUrl || '';
  if (el.modelName) el.modelName.value = s.model || '';
  updateProviderHint();
  el.apiKey.value = s.apiKey;
  el.serverUrl.value = s.server || '';
  el.serverRow.classList.toggle('hidden', !android);
  el.persona.innerHTML = Object.entries(PERSONAS).map(([k, p]) =>
    '<option value="' + k + '"' + (k === s.persona ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
  el.systemPrompt.value = s.system;
  el.smartRoute.checked = !!s.smartRoute;
  el.streaming.checked = !!s.streaming;
  el.temperature.value = s.temperature; el.tempVal.textContent = s.temperature;
  el.topP.value = s.topP; el.topVal.textContent = s.topP;
  el.maxTokens.value = s.maxTokens; el.maxVal.textContent = s.maxTokens;
  el.ttsLang.innerHTML = LANGS.map(([v, l]) => '<option value="' + v + '">' + esc(l) + '</option>').join('');
  el.ttsLang.value = s.ttsLang;
  el.lang.value = s.lang;
  fillVoiceSelect();
  el.rate.value = s.rate; el.rateVal.textContent = (+s.rate).toFixed(2).replace(/0$/, '');
  el.pitch.value = s.pitch; el.pitchVal.textContent = (+s.pitch).toFixed(2).replace(/0$/, '');
  el.autoSpeak.checked = !!s.autoSpeak;
  el.handsFree.checked = !!s.handsFree;
  el.wakeWord.checked = !!s.wakeWord;
  el.autoSend.checked = !!s.autoSend;
  el.theme.value = s.theme;
  el.accents.innerHTML = ACCENTS.map(a => '<button type="button" data-acc="' + a + '" class="' + (a === s.accent ? 'sel' : '') + '" style="background:linear-gradient(135deg,var(--a1),var(--a2))"></button>').join('');
  el.accents.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => {
    el.accents.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
    el.accents.dataset.pick = b.dataset.acc;
  });
  el.accents.dataset.pick = s.accent;
  el.usageBox.innerHTML = usageHtml();
  el.keyStatus.textContent = '';
}
function usageHtml() {
  const msgs = state.chats.reduce((n, c) => n + c.messages.length, 0);
  const chars = state.chats.reduce((n, c) => n + c.messages.reduce((m, x) => m + x.content.length, 0), 0);
  return [
    ['Chats', state.chats.length], ['Messages', msgs],
    ['Chars', chars], ['~Tokens', Math.round(chars / 4)],
    ['Last model', lastMeta ? lastMeta.split(' · ')[0] : '—']
  ].map(([k, v]) => '<div><b>' + v + '</b><br/><span class="muted">' + k + '</span></div>').join('');
}
function saveSettings() {
  const s = state.settings;
  s.apiKey = el.apiKey.value.trim();
  s.server = el.serverUrl.value.trim();
  if (el.provider) s.provider = el.provider.value;
  if (el.baseUrl) s.baseUrl = el.baseUrl.value.trim();
  if (el.modelName && el.modelName.value.trim()) s.model = el.modelName.value.trim();
  s.persona = el.persona.value;
  s.system = el.systemPrompt.value.trim() || DEFAULT_SYSTEM;
  s.smartRoute = el.smartRoute.checked;
  s.streaming = el.streaming.checked;
  s.temperature = +el.temperature.value;
  s.topP = +el.topP.value;
  s.maxTokens = +el.maxTokens.value;
  s.ttsLang = el.ttsLang.value;
  s.lang = el.lang.value;
  s.voiceName = el.voice.value;
  s.rate = +el.rate.value;
  s.pitch = +el.pitch.value;
  s.autoSpeak = el.autoSpeak.checked;
  s.handsFree = el.handsFree.checked;
  s.wakeWord = el.wakeWord.checked;
  s.autoSend = el.autoSend.checked;
  s.theme = el.theme.value;
  s.accent = el.accents.dataset.pick || 'violet';
  applyLook();
  refreshKey();
  persist();
  saveProviderConfig();
  if (s.apiKey) {
    fetch(apiUrl('/api/savekey'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: s.apiKey }) })
      .then(() => { serverHasKey = true; refreshKey(); fetchModels(); }).catch(() => {});
  } else if (el.apiKey.dataset.cleared === '1') {
    fetch(apiUrl('/api/savekey'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delete: true }) })
      .then(() => { serverHasKey = false; refreshKey(); }).catch(() => {});
    el.apiKey.dataset.cleared = '0';
  }
  if (android && s.server) { try { android.setServer(s.server); } catch (_) {} }
  if (android && s.controlToken) { try { android.setControlToken(s.controlToken); } catch (_) {} }
  closeSettings();
  toast('Saved');
}
function refreshKey() {
  const ok = !!state.settings.apiKey || serverHasKey;
  el.brandDot.classList.toggle('ok', ok);
  el.brandDot.classList.toggle('bad', !ok);
  el.brandDot.title = ok ? 'API key set' : 'Add your API key';
  if (el.speakToggle) el.speakToggle.style.opacity = state.settings.autoSpeak ? 1 : 0.45;
  if (el.keyStatus && ok && !el.keyStatus.textContent) el.keyStatus.textContent = 'Server key active';
}

/* ---------- theme ---------- */
function applyLook() {
  const s = state.settings;
  const theme = s.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : s.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = s.accent;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = theme === 'light' ? '#eef1f8' : '#0a1020';
}

/* ---------- palette ---------- */
const COMMANDS = [
  { k: 'New chat', run: () => newChat() },
  { k: 'Open settings', run: openSettings },
  { k: 'Toggle theme', run: () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applyLook(); persist(); } },
  { k: 'Stop speaking', run: stopSpeaking },
  { k: 'Stop generating', run: () => abortCtrl && abortCtrl.abort() },
  { k: 'Speak last reply', run: () => { const c = active(); const last = [...c.messages].reverse().find(m => m.role === 'assistant'); if (last) speak(last.content); } },
  { k: 'Regenerate last reply', run: () => { const c = active(); const i = c.messages.map(m => m.role).lastIndexOf('assistant'); if (i > 0) regenerate(i); } },
  { k: 'Export this chat', run: exportChat },
  { k: 'Export all chats', run: exportAll },
  { k: 'Delete this chat', run: () => deleteChat(state.activeId) },
  { k: 'Control my PC', run: () => openRemote('pc') },
  { k: 'PC screenshot', run: () => { openRemote('pc'); pcAct('screenshot'); } },
  { k: 'Lock my PC', run: () => pcAct('lock') },
  { k: 'Phone controls', run: () => openRemote('phone') },
  { k: 'Cycle model', run: cycleModel },
  { k: 'Cycle persona', run: cyclePersona },
  { k: 'Toggle hands-free', run: () => { state.settings.handsFree = !state.settings.handsFree; persist(); toast('Hands-free ' + (state.settings.handsFree ? 'on' : 'off')); } },
  { k: 'Toggle wake word', run: () => { state.settings.wakeWord = !state.settings.wakeWord; persist(); if (!state.settings.wakeWord) stopListening(); toast('Wake word ' + (state.settings.wakeWord ? 'on' : 'off')); } }
];
function openPalette() {
  el.paletteInput.value = '';
  renderPalette('');
  if (el.palette.showModal) el.palette.showModal(); else el.palette.setAttribute('open', '');
  setTimeout(() => el.paletteInput.focus(), 30);
}
function renderPalette(q) {
  const list = COMMANDS.filter(c => c.k.toLowerCase().includes(q.toLowerCase()));
  el.paletteList.innerHTML = list.map((c, i) =>
    '<div class="palette-item' + (i === 0 ? ' sel' : '') + '" data-i="' + COMMANDS.indexOf(c) + '">' +
    '<span>' + esc(c.k) + '</span><span class="k">↵</span></div>').join('') || '<p class="muted small">No match</p>';
  el.paletteList.querySelectorAll('.palette-item').forEach(n => n.onclick = () => {
    el.palette.close();
    COMMANDS[+n.dataset.i].run();
  });
}
function cycleModel() {
  const list = MODEL_LIST;
  const i = list.indexOf(state.settings.model);
  state.settings.model = list[(i + 1) % list.length];
  el.model.value = state.settings.model;
  persist(); toast('Model: ' + state.settings.model);
}
function cyclePersona() {
  const keys = Object.keys(PERSONAS);
  const i = keys.indexOf(state.settings.persona);
  state.settings.persona = keys[(i + 1) % keys.length];
  state.settings.system = PERSONAS[state.settings.persona].prompt;
  persist(); toast('Persona: ' + PERSONAS[state.settings.persona].name);
}


/* ---------- control: own PC + this phone ---------- */
function pcToken() { return ((el.pcToken && el.pcToken.value) || state.settings.controlToken || '').trim(); }
function pcLog(msg, box) {
  box = box || el.pcLog;
  if (!box) return;
  const d = document.createElement('div');
  d.textContent = msg;
  box.prepend(d);
  while (box.children.length > 80) box.lastChild.remove();
}
async function pcCall(path, body, confirmText) {
  const tok = pcToken();
  if (!tok) throw new Error('pairing token required — run ./run.sh --control');
  const init = { headers: { 'X-Control-Token': tok } };
  if (body) {
    init.method = 'POST';
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(Object.assign({}, body, confirmText ? { confirm: confirmText } : {}));
  }
  const r = await fetch(path, init);
  let j = {};
  try { j = await r.json(); } catch (_) {}
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  state.settings.controlToken = tok; persist();
  return j;
}
function pcShow(j) {
  if (j.image) {
    el.shotImg.src = j.image;
    el.shotWrap.classList.remove('hidden');
    pcLog('screenshot · ' + Math.round((j.bytes || 0) / 1024) + ' KB');
    return;
  }
  if (j.entries) {
    pcLog('📁 ' + j.path);
    j.entries.slice(0, 60).forEach(e => pcLog((e.dir ? '📁 ' : '📄 ') + e.name + (e.dir ? '' : ' · ' + Math.round((e.size || 0) / 1024) + ' KB')));
    return;
  }
  if (j.windows) {
    pcLog('🪟 ' + j.windows.length + ' windows');
    j.windows.forEach(w => pcLog('· ' + w.title));
    return;
  }
  if (j.log) { pcLog('🧾 ' + j.log.length + ' entries'); return; }
  if (j.out || j.err) {
    (j.out || '').trim().split('\n').slice(0, 40).forEach(l => pcLog(l));
    (j.err || '').trim().split('\n').slice(0, 15).forEach(l => pcLog('⚠ ' + l));
    return;
  }
  pcLog('✓ ' + (j.opened || j.action || 'done') + (j.ms ? ' · ' + j.ms + ' ms' : ''));
}
async function pcAct(action, args, confirmText) {
  try {
    const j = await pcCall('/api/pc/action', { action, args: args || {} }, confirmText);
    pcShow(j);
    return j;
  } catch (e) {
    pcLog('⚠ ' + e.message);
    throw e;
  }
}
async function pcInfo(quiet) {
  try {
    const j = await pcCall('/api/pc/info');
    el.pcState.textContent = '✓ connected';
    el.pcState.style.color = 'var(--ok, #59d18c)';
    const bits = [
      ['PC', j.host || '—'], ['User', j.user || '—'], ['IP', j.ip || '—'],
      ['Uptime', (j.uptime_h ?? '—') + ' h'],
      ['Memory', (j.mem_used_mb ?? '—') + ' / ' + (j.mem_total_mb ?? '—') + ' MB'],
      ['Disk free', (j.disk_free_gb ?? '—') + ' GB'],
      ['Volume', (j.volume ?? '—') + '%' + (j.muted ? ' · muted' : '')],
      ['Window', j.window || '—']
    ];
    el.pcInfo.innerHTML = bits.map(([k, v]) =>
      '<div><b>' + esc(String(v)).slice(0, 64) + '</b><br/><span class="muted">' + k + '</span></div>').join('');
    return j;
  } catch (e) {
    el.pcState.textContent = '⚠ ' + e.message;
    el.pcState.style.color = 'var(--danger)';
    if (!quiet) pcLog('⚠ ' + e.message);
  }
}
async function pcWindows() {
  try {
    const j = await pcCall('/api/pc/action', { action: 'windows' });
    pcLog('🪟 ' + j.windows.length + ' windows — tap one to focus');
    j.windows.slice(0, 40).forEach(w => {
      const row = document.createElement('div');
      row.className = 'win-row';
      const t = document.createElement('span');
      t.textContent = w.title.slice(0, 64) || '(untitled)';
      const b = document.createElement('span');
      b.className = 'muted';
      b.textContent = 'focus';
      row.append(t, b);
      row.onclick = () => pcAct('focus', { name: w.title.slice(0, 48) }).then(() => setTimeout(() => pcInfo(true), 500)).catch(() => {});
      el.pcLog.prepend(row);
      while (el.pcLog.children.length > 80) el.pcLog.lastChild.remove();
    });
  } catch (e) { pcLog('⚠ ' + e.message); }
}
async function pcFiles(path) {
  try {
    const j = await pcCall('/api/pc/action', { action: 'files', args: { path: path || '~' } });
    const box = el.pcLog;
    box.innerHTML = '';
    const up = document.createElement('div');
    up.className = 'win-row';
    up.textContent = '⬆ ' + (j.path || '~');
    up.onclick = () => pcFiles(j.parent || '~');
    box.append(up);
    j.entries.slice(0, 80).forEach(e => {
      const row = document.createElement('div');
      row.className = 'win-row';
      const t = document.createElement('span');
      t.textContent = (e.dir ? '📁 ' : '📄 ') + e.name;
      const b = document.createElement('span');
      b.className = 'muted';
      b.textContent = e.dir ? '' : Math.round((e.size || 0) / 1024) + ' KB';
      row.append(t, b);
      const full = (j.path || '~').replace(/\/$/, '') + '/' + e.name;
      row.onclick = () => e.dir ? pcFiles(full) : pcAct('read', { path: full }).then(r => {
        if (r && r.text) { pcLog('📄 ' + full); r.text.slice(0, 4000).split('\n').forEach(l => pcLog(l)); }
      }).catch(() => {});
      box.append(row);
    });
  } catch (e) { pcLog('⚠ ' + e.message); }
}
async function pcPower() {
  const what = (prompt('PC power — type: lock, suspend, poweroff or reboot', 'lock') || '').trim().toLowerCase();
  if (!what) return;
  if (what === 'lock') { pcAct('lock'); return; }
  if (!['suspend', 'poweroff', 'reboot'].includes(what)) { pcLog('unknown: ' + what); return; }
  const sure = prompt('Type YES to ' + what + ' this PC', '');
  if ((sure || '').trim().toUpperCase() !== 'YES') { pcLog('cancelled'); return; }
  try {
    await pcCall('/api/pc/action', { action: what }, 'yes');
    pcLog('✓ ' + what + ' sent');
  } catch (e) { pcLog('⚠ ' + e.message); }
}
async function loadAudit() {
  try {
    const j = await pcCall('/api/pc/audit');
    el.auditBox.innerHTML = (j.log || []).slice().reverse().map(x =>
      '<div>' + esc(x.ts || '') + ' · ' + esc(x.action || '') + ' · ' + (x.ok ? 'ok' : 'fail') +
      (x.from ? ' · ' + esc(x.from) : '') + '</div>').join('') || '<span class="muted">empty</span>';
  } catch (e) { el.auditBox.textContent = '⚠ ' + e.message; }
}
const PC_BTNS = {
  screenshot: () => pcAct('screenshot'),
  lock: () => pcAct('lock'),
  volup: () => pcAct('volume', { cmd: 'up' }),
  voldown: () => pcAct('volume', { cmd: 'down' }),
  mute: () => pcAct('volume', { cmd: 'mute' }),
  play: () => pcAct('media', { cmd: 'play' }),
  prev: () => pcAct('media', { cmd: 'prev' }),
  next: () => pcAct('media', { cmd: 'next' }),
  windows: pcWindows,
  files: () => pcFiles('~'),
  notify: () => pcAct('notify', { text: 'Hello from Kadhali 📱' }),
  audit: loadAudit
};
const PC_KEYMAP = ['enter', 'tab', 'esc', 'backspace', 'up', 'down', 'left', 'right', 'ctrl+plus', 'ctrl+minus', 'super+d', 'f5'];
function openRemote(tab) {
  if (!el.remote) return;
  el.phoneInfo && setTimeout(phoneInfo, 50);
  if (tab) selectRemoteTab(tab);
  if (el.remote.showModal) { if (!el.remote.open) el.remote.showModal(); } else el.remote.setAttribute('open', '');
  if (tab !== 'phone' && controlOn) pcInfo(true);
}
function selectRemoteTab(tab) {
  document.querySelectorAll('[data-rtab]').forEach(b => b.classList.toggle('active', b.dataset.rtab === tab));
  document.querySelectorAll('[data-rpane]').forEach(p => p.classList.toggle('active', p.dataset.rpane === tab));
  if (tab === 'phone') phoneInfo();
  if (tab === 'log') loadAudit();
}
function hasBridge() { return !!(android && android.deviceInfo); }
function phoneInfo() {
  if (!el.phoneInfo) return;
  if (!hasBridge()) {
    el.phoneInfo.innerHTML = '<div class="muted">Open the Kadhali Android app to control this phone.</div>';
    return;
  }
  try {
    const j = JSON.parse(android.deviceInfo());
    const bits = [['Device', j.model], ['Brand', j.brand], ['Android', j.android], ['SDK', j.sdk],
      ['Battery', (j.battery != null ? j.battery + '%' + (j.charging ? ' ⚡' : '') : '—')]];
    el.phoneInfo.innerHTML = bits.map(([k, v]) =>
      '<div><b>' + esc(String(v == null ? '—' : v)).slice(0, 48) + '</b><br/><span class="muted">' + k + '</span></div>').join('');
  } catch (e) {
    el.phoneInfo.innerHTML = '<div class="muted">Device details unavailable</div>';
  }
}
function phoneLog(msg) { pcLog(msg, el.phoneLog); }
function bindRemote() {
  if (!el.remote) return;
  el.remoteBtn.onclick = () => openRemote('pc');
  el.closeRemote.onclick = () => el.remote.close();
  document.querySelectorAll('[data-rtab]').forEach(b => b.onclick = () => selectRemoteTab(b.dataset.rtab));
  el.pcConnect.onclick = async () => {
    state.settings.controlToken = pcToken();
    persist();
    await pcInfo();
    if (el.pcState.textContent.startsWith('✓')) toast('PC connected');
  };
  el.pcRefresh.onclick = () => pcInfo();
  document.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => {
    const fn = PC_BTNS[b.dataset.pc];
    if (fn) Promise.resolve(fn()).catch(() => {});
  });
  el.pcTypeBtn.onclick = () => { if (el.pcType.value) pcAct('type', { text: el.pcType.value }).then(() => { el.pcType.value = ''; }).catch(() => {}); };
  el.pcType.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.pcTypeBtn.click(); } };
  el.pcEnterBtn.onclick = () => pcAct('key', { name: 'enter' });
  el.pcBackBtn.onclick = () => pcAct('key', { name: 'backspace' });
  el.pcKeys.innerHTML = PC_KEYMAP.map(k => '<button type="button" class="ghost" data-key="' + esc(k) + '">' + esc(k) + '</button>').join('');
  el.pcKeys.querySelectorAll('[data-key]').forEach(b => b.onclick = () => pcAct('key', { name: b.dataset.key }));
  fetch(apiUrl('/api/config')).then(r => r.json()).then(j => {
    const rc = j.run_commands;
    const cmds = Array.isArray(rc) ? rc : (rc ? Object.keys(rc) : ['date', 'uptime', 'disk', 'memory', 'whoami', 'uname']);
    const names = cmds.length ? cmds : ['date'];
    el.pcRunSel.innerHTML = names.map(c => '<option>' + esc(c) + '</option>').join('');
  }).catch(() => { el.pcRunSel.innerHTML = '<option>date</option>'; });
  el.pcRunBtn.onclick = () => pcAct('run', { cmd: el.pcRunSel.value || 'date' });
  el.pcPower.onclick = pcPower;
  el.auditRefresh.onclick = loadAudit;
  el.phTorch.onclick = () => { if (!hasBridge() || !android.toggleTorch) return phoneLog('Torch needs the Android app'); try { phoneLog(android.toggleTorch() === '1' ? '🔦 torch on' : 'torch off'); } catch (e) { phoneLog('⚠ torch unavailable'); } };
  el.phVibrate.onclick = () => { if (hasBridge() && android.vibrate) { try { android.vibrate(250); phoneLog('📳 vibrated'); } catch (_) {} } };
  el.phCopy.onclick = () => {
    if (!hasBridge() || !android.setClipboard) return phoneLog('Clipboard needs the Android app');
    try { android.setClipboard(el.phClip.value || ''); phoneLog('copied to phone clipboard'); } catch (_) { phoneLog('⚠ copy failed'); }
  };
  el.phPaste.onclick = () => {
    if (!hasBridge() || !android.getClipboard) return phoneLog('Clipboard needs the Android app');
    try { el.phClip.value = android.getClipboard() || ''; phoneLog('pasted from phone clipboard'); } catch (_) { phoneLog('⚠ paste failed'); }
  };
  el.phShare.onclick = () => {
    if (!hasBridge() || !android.share) return phoneLog('Share needs the Android app');
    const t = el.phClip.value || (active().messages.filter(m => m.role === 'assistant').pop() || {}).content || '';
    try { android.share(t.slice(0, 4000)); phoneLog('share sheet opened'); } catch (_) {}
  };
  el.phBattery.onclick = phoneInfo;
  el.phOpen.onclick = () => {
    if (!hasBridge() || !android.openSettings) return phoneLog('Settings need the Android app');
    try { android.openSettings(el.phSettings.value); phoneLog('opened ' + el.phSettings.value); } catch (_) {}
  };
  if (el.removeKey) el.removeKey.onclick = () => {
    if (!confirm('Remove the saved API key from this computer?')) return;
    el.apiKey.value = '';
    el.apiKey.dataset.cleared = '1';
    state.settings.apiKey = '';
    persist(); refreshKey();
    fetch(apiUrl('/api/savekey'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delete: true }) })
      .then(() => { serverHasKey = false; refreshKey(); el.keyStatus.textContent = 'Key removed'; })
      .catch(() => { el.keyStatus.textContent = 'Remove failed'; });
  };
}
function localReply(content) {
  const c = active();
  c.messages.push({ role: 'assistant', content: content, ts: Date.now(), meta: 'local' });
  c.updated = Date.now();
  persist(); renderChatList(); render();
}
async function slashCommand(text) {
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(' ');
  try {
    if (cmd === '/help') { localReply('**Local commands**\n\n`/pc` info · `/shot` screenshot · `/vol up|down|mute`\n`/lock` · `/windows` · `/files [path]` · `/type text` · `/key enter`\n`/run date` · `/notify text` · `/mpc app`\n\nOpen the 🖥 panel for buttons.'); return true; }
    if (cmd === '/pc') { const j = await pcCall('/api/pc/info'); localReply('**' + j.host + '** · ' + j.user + '\nIP ' + j.ip + ' · up ' + j.uptime_h + ' h\nMemory ' + j.mem_used_mb + '/' + j.mem_total_mb + ' MB · disk free ' + j.disk_free_gb + ' GB\nVolume ' + j.volume + '%' + (j.muted ? ' (muted)' : '') + '\nWindow: ' + (j.window || '—')); return true; }
    if (cmd === '/shot') { await pcAct('screenshot'); localReply('Screenshot captured — open the 🖥 panel to view it.'); return true; }
    if (cmd === '/vol') {
      const m = { up: 'up', '+': 'up', down: 'down', '-': 'down', mute: 'mute' }[arg] || 'mute';
      await pcAct('volume', { cmd: m }); localReply('Volume: ' + m); return true;
    }
    if (cmd === '/lock') { await pcAct('lock'); localReply('PC locked.'); return true; }
    if (cmd === '/windows') { const j = await pcCall('/api/pc/action', { action: 'windows' }); localReply('**Windows**\n' + j.windows.slice(0, 15).map(w => '· ' + w.title).join('\n')); return true; }
    if (cmd === '/files') { const j = await pcCall('/api/pc/action', { action: 'files', args: { path: arg || '~' } }); localReply('**' + j.path + '**\n' + j.entries.slice(0, 25).map(e => (e.dir ? '📁 ' : '📄 ') + e.name).join('\n')); return true; }
    if (cmd === '/type') { if (!arg) return true; await pcAct('type', { text: arg }); localReply('Typed on PC.'); return true; }
    if (cmd === '/key') { await pcAct('key', { name: arg || 'enter' }); localReply('Key: ' + (arg || 'enter')); return true; }
    if (cmd === '/run') { const j = await pcAct('run', { cmd: arg || 'date' }); localReply('**$ ' + (arg || 'date') + '**\n```\n' + ((j.out || '') + (j.err ? '\n' + j.err : '')).slice(0, 3000) + '\n```'); return true; }
    if (cmd === '/notify') { await pcAct('notify', { text: arg || 'Hello from Kadhali' }); localReply('Notification sent.'); return true; }
    if (cmd === '/mpc') { const j = await pcAct('open', { target: arg || 'files' }); localReply('Opened ' + (j.opened || arg)); return true; }
    return false;
  } catch (e) {
    localReply('⚠ ' + e.message);
    return true;
  }
}

/* ---------- export ---------- */
function exportChat() {
  const c = active();
  const md = '# ' + c.title + '\n\n' + c.messages.map(m =>
    '**' + (m.role === 'user' ? 'You' : 'Kadhali') + '** · ' + new Date(m.ts || Date.now()).toLocaleString() + '\n\n' + m.content).join('\n\n---\n\n');
  download('kadhali-' + c.id + '.md', md, 'text/markdown');
}
function exportAll() {
  download('kadhali-chats-' + Date.now() + '.json', JSON.stringify({ settings: state.settings, chats: state.chats }, null, 2), 'application/json');
}

/* ---------- models ---------- */
function fillModels(list) {
  const preset = ((state.providers || {})[state.settings.provider] || PROVIDER_FALLBACK[state.settings.provider] || {}).models || [];
  const models = (list && list.length) ? list : (preset.length ? preset : MODEL_LIST);
  if (state.settings.model && !models.includes(state.settings.model)) models.unshift(state.settings.model);
  el.model.innerHTML = models.map(m => '<option value="' + esc(m) + '"' + (m === state.settings.model ? ' selected' : '') + '>' + esc(m) + '</option>').join('');
  el.model.value = state.settings.model;
  if (el.modelOptions) el.modelOptions.innerHTML = models.slice(0, 400).map(m => '<option value="' + esc(m) + '"></option>').join('');
  if (el.modelName) el.modelName.value = state.settings.model;
}
async function fetchModels() {
  if (!state.settings.apiKey && !serverHasKey) return;
  try {
    const r = await fetch(apiUrl('/api/models'), { headers: { 'X-API-Key': state.settings.apiKey } });
    if (!r.ok) return;
    const j = await r.json();
    const list = (j.working && j.working.length) ? j.working : j.models;
    if (list && list.length) fillModels(list);
  } catch (_) {}
}

function providerPresets() { return state.providers || PROVIDER_FALLBACK; }

function fillProviderSelect() {
  if (!el.provider) return;
  const presets = providerPresets();
  el.provider.innerHTML = Object.entries(presets).map(([k, p]) =>
    '<option value="' + esc(k) + '"' + (k === state.settings.provider ? ' selected' : '') + '>' + esc(p.name || k) + '</option>').join('');
}

async function saveProviderConfig(extra) {
  const body = Object.assign({
    provider: state.settings.provider,
    base_url: state.settings.baseUrl || '',
    model: state.settings.model || ''
  }, extra || {});
  try {
    const r = await fetch(apiUrl('/api/saveconfig'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { el.keyStatus.textContent = j.error || ('Config failed (' + r.status + ')'); return false; }
    state.settings.provider = j.provider || state.settings.provider;
    state.settings.baseUrl = j.base_url || state.settings.baseUrl;
    state.settings.model = j.model || state.settings.model;
    persist();
    return true;
  } catch (_) { el.keyStatus.textContent = 'Network error'; return false; }
}
async function loadConfig() {
  try {
    const r = await fetch(apiUrl('/api/config'));
    const j = await r.json();
    serverHasKey = !!j.has_key;
    controlOn = !!j.control;
    if (j.providers) state.providers = j.providers;
    if (j.provider) state.settings.provider = j.provider;
    if (j.base_url) state.settings.baseUrl = j.base_url;
    if (j.model) state.settings.model = j.model;
    if (el.pcOff) el.pcOff.classList.toggle('hidden', controlOn);
    if (j.token) { state.settings.controlToken = j.token; if (el.pcToken) el.pcToken.value = j.token; }
    fillProviderSelect();
    if (el.baseUrl) el.baseUrl.value = state.settings.baseUrl || '';
    if (j.models && j.models.length) fillModels(j.models);
    else fillModels(null);
    refreshKey();
  } catch (_) {}
}

/* ---------- PWA ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvt = e;
});

/* ---------- events ---------- */
function bind() {
  el.sendBtn.onclick = () => send();
  el.input.addEventListener('input', autosize);
  el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  el.stopBtn.onclick = () => abortCtrl && abortCtrl.abort();
  el.micBtn.onclick = () => {
    if (listening) { awaitingCommand = false; stopListening(); }
    else { stopSpeaking(); startListening(false); }
  };
  el.speakToggle.onclick = () => {
    state.settings.autoSpeak = !state.settings.autoSpeak;
    if (!state.settings.autoSpeak) stopSpeaking();
    refreshKey(); persist(); toast('Auto-speak ' + (state.settings.autoSpeak ? 'on' : 'off'));
  };
  el.attachBtn.onclick = () => el.fileInput.click();
  el.fileInput.onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
  el.newChat.onclick = () => { newChat(); closeSidebar(); };
  el.searchChats.oninput = renderChatList;
  el.chatList.onclick = (e) => {
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); if (confirm('Delete this chat?')) deleteChat(del.dataset.del); return; }
    const item = e.target.closest('.chat-item');
    if (item) { state.activeId = item.dataset.id; persist(); renderChatList(); render(); closeSidebar(); }
  };
  el.themeBtn.onclick = () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    applyLook(); persist();
  };
  el.settingsBtn.onclick = openSettings;
  el.settleBtn.onclick = openSettings;
  el.closeSettings.onclick = (e) => { e.preventDefault(); closeSettings(); };
  el.saveSettings.onclick = saveSettings;
  el.paletteBtn.onclick = openPalette;
  el.paletteInput.oninput = () => renderPalette(el.paletteInput.value);
  el.paletteInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const first = el.paletteList.querySelector('.palette-item');
      if (first) { el.palette.close(); COMMANDS[+first.dataset.i].run(); }
    }
  };
  el.menuBtn.onclick = openSidebar;
  el.closeSide.onclick = closeSidebar;
  el.scrim.onclick = closeSidebar;
  el.model.onchange = () => { state.settings.model = el.model.value; state.settings.smartRoute = false; persist(); if (el.modelName) el.modelName.value = el.model.value; saveProviderConfig(); toast('Model: ' + el.model.value); };
  if (el.provider) el.provider.onchange = () => {
    state.settings.provider = el.provider.value;
    const p = providerPresets()[state.settings.provider] || {};
    if (p.base_url) { state.settings.baseUrl = p.base_url; el.baseUrl.value = p.base_url; }
    if (p.key_url) el.providerHint.innerHTML = 'Get a key at <a href="' + esc(p.key_url) + '" target="_blank" rel="noopener">' + esc(p.key_url.replace(/^https?:\/\//, '')) + '</a>. Works with any model the provider offers.';
    else el.providerHint.textContent = 'Point the base URL at any OpenAI-compatible endpoint (e.g. http://127.0.0.1:8000/v1).';
    fillModels((p.models && p.models.length) ? p.models : null);
    saveProviderConfig();
  };
  if (el.refreshModels) el.refreshModels.onclick = async () => {
    await saveProviderConfig();
    el.keyStatus.textContent = 'Loading models…';
    await fetchModels();
    el.keyStatus.textContent = 'Models refreshed';
  };
  if (el.modelName) el.modelName.onchange = () => {
    const m = el.modelName.value.trim();
    if (!m) return;
    state.settings.model = m; state.settings.smartRoute = false; persist();
    fillModels(null); saveProviderConfig(); toast('Model: ' + m);
  };
  el.lang.onchange = () => { state.settings.lang = el.lang.value; if (state.settings.ttsLang === 'auto') { pickVoice(); fillVoiceSelect(); } persist(); el.lang.value = state.settings.lang; };
  el.exportAllBtn.onclick = exportAll;
  el.testKey.onclick = async () => {
    const key = el.apiKey.value.trim();
    if (!key) { el.keyStatus.textContent = 'Enter a key first'; return; }
    el.keyStatus.textContent = 'Testing…';
    await saveProviderConfig();
    try {
      const r = await fetch(apiUrl('/api/models'), { headers: { 'X-API-Key': key } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { el.keyStatus.textContent = 'Failed (' + r.status + ')' + (j.error ? ' — ' + String(j.error).slice(0, 80) : ''); return; }
      el.keyStatus.textContent = '✓ ' + (j.models ? j.models.length : 0) + ' models available';
      if (j.working && j.working.length) fillModels(j.working);
      else if (j.models && j.models.length) fillModels(j.models);
    } catch (e) { el.keyStatus.textContent = 'Network error'; }
  };
  el.testVoice.onclick = () => speak('Hi, I am Kadhali. உங்களுக்கு எப்படி உதவலாம்?');
  el.rate.oninput = () => { el.rateVal.textContent = (+el.rate.value).toFixed(2).replace(/0$/, ''); };
  el.pitch.oninput = () => { el.pitchVal.textContent = (+el.pitch.value).toFixed(2).replace(/0$/, ''); };
  el.temperature.oninput = () => { el.tempVal.textContent = el.temperature.value; };
  el.topP.oninput = () => { el.topVal.textContent = el.topP.value; };
  el.maxTokens.oninput = () => { el.maxVal.textContent = el.maxTokens.value; };
  el.persona.onchange = () => { el.systemPrompt.value = PERSONAS[el.persona.value].prompt; };
  el.ttsLang.onchange = () => { pickVoice(); fillVoiceSelect(); };
  el.voice.onchange = () => { state.settings.voiceName = el.voice.value; };
  el.theme.onchange = () => { state.settings.theme = el.theme.value; };
  el.exportData.onclick = exportAll;
  el.importData.onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const j = JSON.parse(String(r.result));
          if (j.settings) state.settings = Object.assign({}, defaults, j.settings);
          if (Array.isArray(j.chats)) { state.chats = j.chats; state.activeId = j.chats[0] && j.chats[0].id; }
          persist(); applyLook(); renderChatList(); render(); fillSettingsUI(); refreshKey();
          toast('Imported');
        } catch (e) { toast('Invalid file'); }
      };
      r.readAsText(f);
    };
    inp.click();
  };
  el.clearData.onclick = () => {
    if (!confirm('Delete all chats?')) return;
    state.chats = []; localStorage.removeItem(LS_KEY);
    state.settings = { ...defaults };
    load(); persist(); renderChatList(); render(); refreshKey(); applyLook(); closeSettings();
    toast('All chats deleted');
  };
  el.chat.onscroll = () => {
    const near = el.chat.scrollHeight - el.chat.scrollTop - el.chat.clientHeight < 200;
    el.scrollDown.classList.toggle('hidden', near);
  };
  el.scrollDown.onclick = () => { el.chat.scrollTop = el.chat.scrollHeight; };
  el.onboardSave.onclick = () => {
    const k = el.onboardKey.value.trim();
    if (!k) return;
    state.settings.apiKey = k; persist(); el.onboard.close(); refreshKey(); saveProviderConfig(); fetchModels();
    fetch(apiUrl('/api/savekey'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }) }).catch(() => {});
    toast('Ready. Say something!');
  };
  el.onboardSkip.onclick = () => el.onboard.close();
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat(); }
    if (e.key === 'Escape' && streaming) abortCtrl && abortCtrl.abort();
  });
  window.addEventListener('online', () => toast('Back online'));
  window.addEventListener('offline', () => toast('Offline — replies need internet'));
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
}
function openSidebar() { el.sidebar.classList.add('open'); el.scrim.classList.add('show'); }
function closeSidebar() { el.sidebar.classList.remove('open'); el.scrim.classList.remove('show'); }

/* ---------- boot ---------- */
async function init() {
  load();
  bind();
  bindRemote();
  if (android && !state.settings.server) {
    try { const s = android.getServer(); if (s) state.settings.server = s; } catch (_) {}
  }
  if (android && android.getControlToken) {
    try { const t = android.getControlToken(); if (t) { state.settings.controlToken = t; if (el.pcToken) el.pcToken.value = t; } } catch (_) {}
  }
  await loadConfig();
  fillModels();
  el.lang.innerHTML = LANGS.map(([v, l]) => '<option value="' + v + '">' + esc(l) + '</option>').join('');
  el.lang.value = state.settings.lang;
  applyLook();
  refreshKey();
  renderChatList();
  render();
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  initRecognition();
  fetchModels();
  if (!state.settings.apiKey && !serverHasKey) {
    setTimeout(() => { if (el.onboard.showModal) el.onboard.showModal(); }, 600);
  }
  if (android && !state.settings.server && !state.settings.apiKey && !serverHasKey) setTimeout(() => { toast('Add your API key (⚙ → API)'); }, 900);
  if (state.settings.wakeWord) setTimeout(() => startListening(true), 1200);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
init();
