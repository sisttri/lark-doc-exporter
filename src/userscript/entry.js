import { convertCapture, imageHtmlPath } from '../feishu.js';
import { readDocumentParts } from '../importer.js';
import * as formats from '../formats.js';
import { safeStem, warningLabel } from '../shared.js';
import { capturePage, readDocumentSource } from './capture.js';
import { css } from './entry-style.js';
import { installTheme } from './theme.js';

const prefix = 'feishu-local-export-';
const formatKey = prefix + 'formats';
const choices = [['markdown', 'Markdown'], ['html', 'HTML'], ['pdf', 'PDF'], ['attachments', '素材包']];
const descriptions = ['便于编辑 · 含图片', '浏览器直接打开', '阅读与打印', '已采集图片与清单'];

async function defaultPdf(snapshot, options) {
  const { renderPdf } = await import('./pdf.js');
  return renderPdf(snapshot, options);
}

export function installPageExporter(view, {
  capture = capturePage,
  readSource = () => readDocumentSource(view),
  registerMenu = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : view.GM_registerMenuCommand,
  renderPdf = defaultPdf,
} = {}) {
  const { document, location } = view;
  if (document.getElementById(prefix + 'panel')) return;
  let pageKey = '', documentToken = '', currentRoot = null;
  let previousToken = '', previousRoot = null, waitStarted = 0, waitingTimer = null;
  let source, ready = false, chooserOpen = false, cardOpen = false;
  let task = null, snapshot = null, snapshotOwner = null, result = null, pdfNotes = [];
  let lastRun = null, failed = false, noticeId = 0, mode = 'fresh';
  let snapshotAt = '', outcome = 'idle', unreadNotice = false, pointerInside = false;
  let keyboardMode = false, visible = false, visibilityAnimation = null, screen = '';
  let launcherState = '', drag = null, suppressClick = false, position = .62;
  try { const stored = Number(view.localStorage.getItem(prefix + 'position')); if (stored > 0 && stored < 1) position = stored; } catch {}

  function element(tag, key, text) {
    const el = document.createElement(tag);
    if (key) el.id = prefix + key;
    if (text) el.textContent = text;
    return el;
  }
  function button(key, text, action) {
    const el = element('button', key, text);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  }
  function icon(kind) {
    if (!document.createElementNS) return element('span', '', kind === 'check' ? '✓' : kind === 'close' ? '×' : '↓');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', kind === 'check' ? 'm5 12 4 4L19 6' : kind === 'close' ? 'm6 6 12 12M6 18 18 6'
      : kind === 'busy' ? 'M20 12a8 8 0 1 1-5-7.4' : 'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4');
    svg.append(path); return svg;
  }
  function selected() { return inputs.filter(input => input.checked).map(input => input.value); }
  function storedFormats() {
    try {
      const stored = JSON.parse(view.localStorage.getItem(formatKey));
      if (Array.isArray(stored) && choices.some(([kind]) => stored.includes(kind))) return stored;
    } catch {}
    return ['markdown'];
  }

  const style = element('style'); style.textContent = css; document.head.append(style);
  const panel = element('div', 'panel');
  const launcher = button('launcher', '', event => {
    if (suppressClick) { suppressClick = false; return; }
    if (event.detail === 0) inputMode(true);
    if (chooserOpen || cardOpen) closeChooser(); else openChooser();
  });
  launcher.setAttribute('aria-label', '保存到本地'); launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', prefix + 'popover'); launcher.setAttribute('aria-haspopup', 'dialog');
  const glyph = element('span'); glyph.className = 'glyph';
  const tooltip = element('span', '', '保存到本地'); tooltip.className = 'tooltip'; tooltip.setAttribute('aria-hidden', 'true');
  launcher.append(glyph, tooltip);
  const popover = element('section', 'popover'); popover.hidden = true;
  popover.setAttribute('role', 'dialog'); popover.setAttribute('aria-label', '文档保存');
  const chooser = element('section', 'chooser');
  const chooserHeader = element('header');
  const close = button('close', '', closeChooser); close.append(icon('close')); close.className = 'quiet'; close.setAttribute('aria-label', '收起面板');
  const title = element('div', 'title');
  chooserHeader.append(title, close);
  const options = element('div', 'formats');
  const saved = storedFormats();
  const inputs = choices.map(([kind, name], index) => {
    const label = element('label');
    const input = element('input'); input.type = 'checkbox'; input.value = kind; input.checked = saved.includes(kind);
    input.addEventListener('change', () => {
      try { view.localStorage.setItem(formatKey, JSON.stringify(selected())); } catch {}
      controls();
    });
    const copy = element('span', '', name); copy.className = 'format-copy'; copy.append(element('small', '', descriptions[index]));
    label.append(input, copy); options.append(label);
    return input;
  });
  const plan = element('div', 'plan');
  const availability = element('div', 'availability'); availability.setAttribute('role', 'status');
  const reload = button('reload', '重新载入页面', () => location.reload());
  const snapshotNote = element('div', 'snapshot-note');
  const submit = button('button', '保存到本地', () => run(mode === 'reuse'));
  const supplement = button('supplement', '补存其他格式', () => {
    syncPage(); if (!snapshot || task || !belongsToPage(snapshotOwner)) return;
    mode = 'reuse'; chooserOpen = true; cardOpen = false; history.open = false; noticeId++; controls(); focusFormats();
  }); supplement.className = 'quiet';
  const fresh = button('fresh', '返回', () => { mode = 'fresh'; controls(); focusFormats(); }); fresh.className = 'quiet';
  const captureNote = element('div', 'capture-note', '采集时页面会自动滚动，结束后回到原位置');
  const notice = element('div', 'notice');
  const noticeText = element('span');
  const noticeDetails = button('notice-details', '查看详情', () => { chooserOpen = false; cardOpen = true; history.open = true; controls(); });
  noticeDetails.className = 'quiet'; notice.append(noticeText, noticeDetails);
  chooser.append(snapshotNote, options, plan, availability, reload, submit, fresh, captureNote, notice);

  const card = element('section', 'card'); card.setAttribute('aria-label', '本地保存状态');
  const cardHeader = element('header');
  const heading = element('strong', 'job-heading', '正在保存');
  const dismiss = button('dismiss', '收起进度', closeChooser); dismiss.className = 'quiet';
  cardHeader.append(heading);
  const bar = element('progress', 'progress'); bar.max = 100;
  const status = element('output', 'status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const resultBox = element('div', 'results');
  const warnings = element('details', 'warnings');
  const actions = element('div', 'actions');
  const cancel = button('cancel', '取消保存', () => {
    if (task) { task.cancelled = true; cancel.disabled = true; status.textContent = '正在取消…'; }
  });
  const retry = button('retry', '重试', () => run(lastRun?.reuse || false, lastRun?.kinds));
  const redownload = button('redownload', '重新下载此文件', () => {
    syncPage();
    if (result && !task && belongsToPage(snapshotOwner)) download(result.blob, result.filename);
  });
  redownload.className = 'quiet'; cancel.className = 'quiet';
  actions.append(dismiss, cancel, retry);
  card.append(cardHeader, bar, status, actions);
  const history = element('details', 'history');
  const historySummary = element('summary');
  const historyTime = element('span', 'history-time'); historySummary.append(historyTime);
  const fileActions = element('div', 'file-actions'); fileActions.append(redownload, supplement);
  history.append(historySummary, resultBox, warnings, fileActions);
  popover.append(chooserHeader, chooser, card, history);
  panel.append(launcher, popover); document.body.append(panel);
  const theme = installTheme(view, panel);

  function openChooser() {
    noticeId++;
    if (task) { cardOpen = true; controls(); return; }
    chooserOpen = true; cardOpen = false; mode = 'fresh'; history.open = false;
    if (outcome === 'success') outcome = 'idle';
    syncPage();
    focusFormats();
  }
  function focusFormats() { (inputs.find(input => input.checked && !input.disabled) || inputs.find(input => !input.disabled) || close).focus?.(); }
  function inputMode(keyboard) { keyboardMode = keyboard; panel.setAttribute('data-input', keyboard ? 'keyboard' : 'pointer'); }
  function closeChooser(restoreFocus = true) {
    if (!chooserOpen && !cardOpen) return;
    if (cardOpen && !task) unreadNotice = false;
    if (outcome === 'success') outcome = 'idle';
    chooserOpen = false; cardOpen = false; noticeId++; controls();
    if (restoreFocus !== false) launcher.focus?.();
  }
  popover.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeChooser(); return; }
  });
  popover.addEventListener('pointerenter', () => { pointerInside = true; });
  popover.addEventListener('pointerleave', () => { pointerInside = false; });
  document.addEventListener('pointerdown', event => {
    inputMode(false);
    if (!popover.contains(event.target) && !launcher.contains(event.target)) closeChooser(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab' || popover.contains(event.target) || launcher.contains(event.target)) inputMode(true);
  });
  function place() {
    const width = view.innerWidth || 1024, height = view.innerHeight || 768;
    const minimum = height >= 340 ? 96 : 12;
    const maximum = Math.max(minimum, height - (height >= 340 ? 160 : 52));
    const top = Math.max(minimum, Math.min(maximum, height * position - 20));
    launcher.style.top = top + 'px';
    const panelWidth = Math.min(320, width - 24);
    const panelHeight = Math.min(popover.offsetHeight || 370, height - 24);
    popover.style.left = Math.max(12, width - 20 - 40 - 10 - panelWidth) + 'px';
    popover.style.top = Math.max(12, Math.min(height - panelHeight - 12, top + 40 - panelHeight + 30)) + 'px';
  }
  launcher.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    suppressClick = false;
    drag = {id:event.pointerId, y:event.clientY, top:parseFloat(launcher.style.top), moved:false};
    launcher.setPointerCapture?.(event.pointerId);
  });
  launcher.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const delta = event.clientY - drag.y;
    if (!drag.moved && Math.abs(delta) < 6) return;
    drag.moved = true; event.preventDefault();
    position = Math.max(.01, Math.min(.99, (drag.top + delta + 20) / (view.innerHeight || 768)));
    place();
  });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    suppressClick = drag.moved && event.type !== 'pointercancel';
    if (drag.moved) {
      position = (parseFloat(launcher.style.top) + 20) / (view.innerHeight || 768);
      try { view.localStorage.setItem(prefix + 'position', String(position)); } catch {}
    }
    drag = null;
  }
  launcher.addEventListener('pointerup', endDrag);
  launcher.addEventListener('pointercancel', endDrag);
  view.addEventListener('resize', place);
  function motionAllowed() { return !keyboardMode && !view.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; }
  function setVisible(open) {
    if (visible === open) return;
    visible = open; visibilityAnimation?.cancel();
    popover.removeAttribute('inert');
    if (open) popover.hidden = false;
    if (!popover.animate || !motionAllowed()) { popover.hidden = !open; return; }
    if (!open) popover.setAttribute('inert', '');
    const frames = [{opacity:0,transform:'translateY(4px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}];
    visibilityAnimation = popover.animate(open ? frames : [...frames].reverse(), {duration:open ? 180 : 130,easing:'cubic-bezier(.2,.8,.2,1)'});
    visibilityAnimation.finished.then(() => { if (!visible) popover.hidden = true; }).catch(() => {});
  }
  function controls() {
    const open = chooserOpen || cardOpen;
    if (open || popover.hidden) { chooser.hidden = !chooserOpen; card.hidden = !cardOpen; }
    const nextScreen = chooserOpen ? 'choose:' + mode : task ? 'task' : outcome;
    if (open && visible && screen !== nextScreen && motionAllowed()) {
      (chooserOpen ? chooser : card).animate?.([{opacity:.35,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}], {duration:140,easing:'ease-out'});
    }
    screen = nextScreen; setVisible(open);
    launcher.setAttribute('aria-expanded', String(open));
    const state = task ? 'busy' : unreadNotice ? 'notice' : outcome === 'success' ? 'check' : 'idle';
    if (state !== launcherState) {
      launcherState = state; launcher.setAttribute('data-state', state);
      glyph.replaceChildren(icon(state === 'notice' || state === 'idle' ? 'download' : state));
      const label = task ? '正在保存，点击查看进度' : unreadNotice ? '保存有提示，点击查看' : '保存到本地';
      launcher.setAttribute('aria-label', label); tooltip.textContent = label;
    }
    for (const input of inputs) input.disabled = Boolean(task);
    submit.disabled = !ready || !selected().length || Boolean(task);
    submit.textContent = mode === 'reuse' ? '补存所选格式' : '保存到本地';
    supplement.hidden = !snapshot || !belongsToPage(snapshotOwner);
    supplement.disabled = !ready || Boolean(task);
    snapshotNote.hidden = mode !== 'reuse'; fresh.hidden = mode !== 'reuse'; captureNote.hidden = mode === 'reuse';
    snapshotNote.textContent = '使用 ' + snapshotAt + ' 读取的内容';
    const kinds = selected();
    plan.textContent = kinds.length > 1 ? '将保存为一个 ZIP，包含所选格式和素材。'
      : kinds[0] === 'markdown' ? '将保存 Markdown 和图片包（ZIP）。'
      : kinds[0] === 'attachments' ? '将保存已采集素材与清单（ZIP）。'
      : kinds[0] ? '将保存一个 ' + kinds[0].toUpperCase() + ' 文件。' : '请选择至少一种格式。';
    reload.hidden = ready || source?.unsupported || !waitStarted || Date.now() - waitStarted < 4000;
    cancel.hidden = !task; cancel.disabled = Boolean(task?.cancelled);
    dismiss.hidden = !task; bar.hidden = !task;
    retry.hidden = !failed || Boolean(task) || !ready;
    redownload.hidden = !result || Boolean(task) || !belongsToPage(snapshotOwner);
    resultBox.hidden = !result || Boolean(task);
    history.hidden = !snapshot || Boolean(task) || !belongsToPage(snapshotOwner);
    historyTime.textContent = (result ? '上次文件' : '已读取的内容') + ' · ' + snapshotAt;
    notice.hidden = !['partial','failed'].includes(outcome);
    noticeText.textContent = failed ? '上次保存失败，可重试。' : '上次保存有内容提示，请核对。';
    place();
  }
  function belongsToPage(owner) {
    if (!owner?.key) return false;
    const current = readSource();
    return owner.key === current.key && owner.token === (current.docToken || '');
  }
  function clearResult() {
    snapshot = null; snapshotOwner = null; snapshotAt = ''; result = null; pdfNotes = []; lastRun = null; failed = false;
    outcome = 'idle'; unreadNotice = false; mode = 'fresh';
    resultBox.replaceChildren(); warnings.replaceChildren(); warnings.hidden = true;
    status.textContent = '';
  }
  function syncPage() {
    theme.refresh();
    source = readSource();
    const key = source.key || '';
    const root = document.querySelector?.('[data-block-type="page"], .page-block');
    const token = source.docToken || '';
    if (key !== pageKey) {
      if (task) task.cancelled = true;
      previousToken = documentToken; previousRoot = currentRoot; waitStarted = Date.now();
      pageKey = key; documentToken = ''; currentRoot = null;
      cardOpen = false; noticeId++; clearResult();
    }
    if ((snapshotOwner && snapshotOwner.token !== token) || (task?.key === key && task.token !== token)) {
      if (task) task.cancelled = true;
      noticeId++; clearResult(); cardOpen = false;
    }
    const rootReplaced = Boolean(previousRoot && root && previousRoot !== root);
    const waitingForPrevious = Boolean(previousToken && (!token || token === previousToken) && !rootReplaced);
    ready = Boolean(key) && source.ready !== false && !source.unsupported && !waitingForPrevious;
    if (ready) {
      previousToken = ''; previousRoot = null; waitStarted = 0;
      documentToken = token; currentRoot = root || currentRoot;
    } else if (!waitStarted) waitStarted = Date.now();
    title.textContent = ready ? source.title : ''; title.setAttribute('title', title.textContent);
    availability.textContent = ready ? '' : source.unsupported ? source.reason
      : waitingForPrevious ? '正在等待当前文档，页面仍显示前一篇正文。'
      : source.reason || '正在等待文档正文加载。';
    availability.hidden = ready;
    if (chooserOpen && !ready && !source.unsupported && waitingTimer === null) {
      waitingTimer = view.setTimeout(() => { waitingTimer = null; syncPage(); }, 400);
    }
    controls();
  }
  function check(op) {
    if (task !== op || op.cancelled || !belongsToPage(op)) throw new DOMException('保存已取消', 'AbortError');
  }
  async function yieldForCancel(op) {
    await new Promise(resolve => view.setTimeout(resolve, 0)); check(op);
  }
  function download(blob, filename) {
    const url = view.URL.createObjectURL(blob);
    const link = element('a'); link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    view.setTimeout(() => view.URL.revokeObjectURL(url), 60000);
  }
  function warningLines() {
    return [...(snapshot?.warnings || []).map(({code, label}) => warningLabel(code) + (label ? ' · ' + label : '')), ...pdfNotes];
  }
  function showWarnings() {
    warnings.replaceChildren();
    const lines = warningLines(); warnings.hidden = !lines.length;
    if (!lines.length) return;
    const list = element('ul');
    for (const line of lines.slice(0, 40)) list.append(element('li', '', line));
    warnings.append(element('summary', '', '内容提示（' + lines.length + ' 条）'), list,
      button('report', '下载完整提示', () => {
        syncPage();
        if (snapshot && !task && belongsToPage(snapshotOwner)) {
          download(new Blob([warningLines().join('\n') + '\n'], {type:'text/plain;charset=utf-8'}), safeStem(snapshot.title) + '-保存提示.txt');
        }
      }));
  }
  function showResult(file) {
    resultBox.replaceChildren();
    if (!file) return;
    resultBox.append(element('strong', '', file.filename));
    if (file.entries) {
      const details = element('details'); const list = element('ul');
      for (const entry of file.entries) list.append(element('li', '', entry.name));
      details.append(element('summary', '', '包内文件（' + file.entries.length + ' 项）'), list); resultBox.append(details);
    }
  }
  async function takeSnapshot(op) {
    status.textContent = '正在采集文档，页面会自动滚动…'; bar.removeAttribute('value');
    const raw = await capture({
      shouldStop: () => task !== op || op.cancelled || !belongsToPage(op),
      onProgress: progress => {
        if (task !== op || op.cancelled || !belongsToPage(op)) return;
        if (['structure', 'audit', 'recheck', 'done'].includes(progress.stage)) {
          status.textContent = '正在核对内容…'; bar.removeAttribute('value');
        } else if (typeof progress.percent === 'number') bar.value = progress.percent;
      },
    });
    check(op);
    status.textContent = '正在整理正文和素材…'; bar.removeAttribute('value');
    await yieldForCancel(op);
    const converted = convertCapture(raw);
    const assets = [];
    for (const image of raw.images) {
      const data = /^data:image\/png;base64,(.+)$/u.exec(image.dataUrl || '');
      if (!data) continue;
      const binary = atob(data[1]); const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
      assets.push({path:imageHtmlPath(image), bytes});
    }
    const next = await readDocumentParts({html:converted.html, assets, name:'capture'});
    check(op); return next;
  }
  async function run(reuse, requestedKinds) {
    syncPage();
    const kinds = requestedKinds || selected();
    if (task || !ready || !kinds.length) return;
    if (reuse && (!snapshot || !belongsToPage(snapshotOwner))) return;
    const op = {key:pageKey, token:documentToken, cancelled:false};
    task = op; lastRun = {reuse, kinds:[...kinds]}; failed = false; outcome = 'idle'; unreadNotice = false; noticeId++;
    chooserOpen = false; cardOpen = true; heading.textContent = '正在保存';
    warnings.hidden = true; controls();
    try {
      const working = reuse ? snapshot : await takeSnapshot(op);
      check(op);
      const readAt = reuse ? snapshotAt : new Date().toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
      // 首次采集已完成时，后续格式生成即使取消也可显式补存。
      if (!snapshot) { snapshot = working; snapshotOwner = op; snapshotAt = readAt; }
      status.textContent = '正在生成文件…'; bar.removeAttribute('value');
      await yieldForCancel(op);
      let pdf = null;
      if (kinds.includes('pdf')) {
        pdf = await renderPdf(working, {
          shouldStop: () => task !== op || op.cancelled || !belongsToPage(op),
          onProgress: message => { if (task === op && !op.cancelled) status.textContent = message || '正在生成 PDF…'; },
        });
        check(op);
      }
      const outputSnapshot = pdf?.notes?.length ? {
        ...working,
        warnings: [...working.warnings, ...pdf.notes.map(label => ({code:'pdf_conversion_note', label}))],
      } : working;
      const downloadKinds = kinds.filter(kind => kind !== 'pdf');
      let next;
      if (kinds.length === 1 && pdf) next = pdf;
      else if (kinds.length === 1 && downloadKinds[0] === 'html') next = await formats.renderFile('html', outputSnapshot);
      else {
        const extraFiles = pdf ? [{name:pdf.filename, bytes:new Uint8Array(await pdf.blob.arrayBuffer())}] : [];
        check(op); next = formats.renderBundle(downloadKinds, outputSnapshot, extraFiles);
      }
      await yieldForCancel(op);
      snapshot = working; snapshotOwner = op; snapshotAt = readAt; result = next;
      pdfNotes = (pdf?.notes || []).map(note => warningLabel('pdf_conversion_note') + ' · ' + note);
      showResult(next); showWarnings();
      download(next.blob, next.filename);
      const partial = warningLines().length > 0;
      outcome = partial ? 'partial' : 'success'; unreadNotice = partial; history.open = true;
      heading.textContent = partial ? '部分保存，请核对' : '文件已生成';
      status.textContent = partial ? '部分保存。已交给浏览器保存，请查看内容提示。' : '已交给浏览器保存。';
      if (!partial) {
        const current = ++noticeId;
        const collapse = () => {
          if (noticeId !== current || task) return;
          if (cardOpen && (pointerInside || (keyboardMode && popover.contains(document.activeElement)))) { view.setTimeout(collapse, 4000); return; }
          cardOpen = false; outcome = 'idle'; controls();
        };
        view.setTimeout(collapse, 4000);
      }
    } catch (error) {
      if (belongsToPage(op)) {
        failed = error.name !== 'AbortError';
        outcome = failed ? 'failed' : 'cancelled'; unreadNotice = failed; history.open = true;
        heading.textContent = failed ? '保存失败' : '已取消';
        status.textContent = failed ? '保存失败：' + error.message : '保存已取消。';
        if (result) status.textContent += '上次保存的文件仍可下载。';
        showWarnings();
      }
    } finally {
      if (task === op) task = null;
      syncPage();
    }
  }

  if (typeof registerMenu === 'function') registerMenu('保存到本地…', openChooser);
  view.navigation?.addEventListener('currententrychange', syncPage);
  view.addEventListener('popstate', syncPage); view.addEventListener('pageshow', syncPage);
  view.setInterval?.(syncPage, 750);
  if (view.MutationObserver) {
    const observer = new view.MutationObserver(syncPage);
    observer.observe(document.head, {childList:true,subtree:true,characterData:true});
  }
  syncPage();
}

if (typeof window !== 'undefined' && window.document) installPageExporter(window);
