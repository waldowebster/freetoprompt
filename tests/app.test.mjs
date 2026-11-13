import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// State/event regressions only. Layout, real input, and browser capabilities
// are checked separately in a real browser (see CONTRIBUTING.md).
function boot(saved = '{}', storageFails = false) {
  let document;
  function element() {
    const handlers = new Map();
    const classes = new Set();
    return {
      value: '', textContent: '', hidden: false, checked: false, disabled: false, open: false,
      showModal() { this.open = true; }, close() { this.open = false; },
      style: { setProperty(k, v) { this[k] = v; } },
      classList: { add: (...v) => v.forEach(x => classes.add(x)), remove: (...v) => v.forEach(x => classes.delete(x)), contains: v => classes.has(v) },
      addEventListener(name, fn) { const list = handlers.get(name) || []; list.push(fn); handlers.set(name, list); },
      fire(name, extra = {}) { for (const fn of handlers.get(name) || []) fn({target: this, currentTarget: this, preventDefault() {}, ...extra}); },
      focus() { document.activeElement = this; }, blur() { document.activeElement = document.body; },
      closest() { return null; }, contains() { return false; }, setAttribute(k, v) { this[k] = v; },
      replaceChildren(...children) { this.children = children; },
      offsetHeight: 2000, clientHeight: 800,
    };
  }
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], element()]));
  for (const m of html.matchAll(/<input type="range" id="(\w+)" min="(\d+)" max="(\d+)"/g)) {
    Object.assign(elements[m[1]], {type: 'range', min: m[2], max: m[3]});
  }
  elements.stage.hidden = true;
  document = Object.assign(element(), {body: element(), documentElement: element(), getElementById: id => elements[id], createElement: element, hidden: false});
  document.activeElement = document.body;
  const window = Object.assign(element(), {innerHeight: 800});
  let frame, stored = saved;
  const timers = [];
  vm.runInNewContext(source, {document, window, navigator: {}, localStorage: {
    getItem() { if (storageFails) throw Error('denied'); return stored; },
    setItem(k, v) { if (storageFails) throw Error('denied'); stored = v; },
  }, performance: {now: () => 0}, requestAnimationFrame: fn => { frame = fn; }, setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}});
  return {elements, document, window, tick: t => frame(t), timers, stored: () => JSON.parse(stored)};
}

test('empty and whitespace-only scripts cannot enter prompting', () => {
  const app = boot('{"text":""}');
  assert.equal(app.elements.btnMode.disabled, true);
  app.elements.script.value = ' \n\t ';
  app.elements.script.fire('input');
  app.window.fire('keydown', {key: 'Enter', ctrlKey: true});
  assert.equal(app.elements.stage.hidden, true);
});

test('corrupt saved settings recover and valid numbers stay within bounds', () => {
  for (const data of ['null', '"bad"', '{broken', '{"text":3,"speed":-100,"size":9999,"width":"bad","mirrorH":"true"}']) {
    const app = boot(data);
    const s = app.stored();
    assert.equal(typeof s.text, 'string');
    assert.ok(s.speed >= 1 && s.speed <= 100);
    assert.ok(s.size >= 24 && s.size <= 160);
    assert.equal(s.width, 80);
    assert.equal(s.mirrorH, false);
  }
});

test('script markup is rendered literally and storage denial does not prevent use', () => {
  const app = boot('{}', true);
  app.elements.script.value = '<img src=x onerror=alert(1)>\nSecond line';
  app.elements.script.fire('input');
  app.elements.btnMode.fire('click');
  assert.equal(app.elements.stage.hidden, false);
  assert.equal(app.elements.content.children[0].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(app.elements.content.children.length, 2);
  assert.equal(app.elements.saveStatus.textContent, 'Not saved');
});

test('pausing and finishing keep controls available; hidden tabs pause playback', () => {
  const app = boot('{"text":"A script","speed":100}');
  app.elements.btnMode.fire('click');
  assert.equal(app.elements.btnPlay.textContent, 'Pause');
  app.elements.btnPlay.fire('click');
  assert.equal(app.elements.btnPlay.textContent, 'Play');
  app.timers.at(-1)();
  assert.equal(app.document.body.classList.contains('idle'), false);
  app.elements.btnPlay.fire('click');
  assert.equal(app.elements.btnPlay.textContent, 'Pause');
  app.document.hidden = true;
  app.document.fire('visibilitychange');
  assert.equal(app.elements.btnPlay.textContent, 'Play');
  app.document.hidden = false;
  app.elements.btnPlay.fire('click');
  for (let t = 100; t <= 15000; t += 100) app.tick(t);
  assert.equal(app.elements.btnPlay.textContent, 'Play');
  assert.equal(app.elements.paused.textContent, 'Finished');
});

test('focused controls retain their native keys and mirror excludes controls', () => {
  const app = boot('{"text":"A script"}');
  app.elements.btnMode.fire('click');
  const before = app.elements.speed.value;
  app.window.fire('keydown', {key: 'ArrowRight', target: {closest: () => app.elements.speed}});
  assert.equal(app.elements.speed.value, before);
  app.window.fire('keydown', {key: 'm'});
  assert.equal(app.elements.reading.style.transform, 'scale(-1, 1)');
  assert.equal(app.elements.stage.style.transform, undefined);
  app.window.fire('keydown', {key: 'Escape'});
  assert.equal(app.elements.stage.hidden, true);
  assert.equal(app.document.activeElement, app.elements.script);
});

test('Play starts scrolling immediately and returning preserves the draft', () => {
  const app = boot('{"text":"Keep this draft"}');
  app.elements.btnMode.fire('click');
  app.tick(100);
  assert.equal(app.elements.btnPlay.textContent, 'Pause');
  assert.notEqual(app.elements.content.style.transform, 'translate3d(0, 0px, 0)');
  app.elements.btnMode.fire('click');
  assert.equal(app.elements.stage.hidden, true);
  assert.equal(app.elements.btnMode.textContent, 'Play');
  assert.equal(app.elements.script.value, 'Keep this draft');
});


test('new visitors default to size 46 while saved preferences are preserved', () => {
  assert.equal(boot().stored().size, 46);
  assert.equal(boot('{"size":72}').stored().size, 72);
});

test('reset requires confirmation, preserves settings, and saves the cleared draft', () => {
  const app = boot('{"text":"Keep until confirmed","size":72,"speed":30,"bright":85,"mirrorH":true}');
  const e = app.elements;
  e.btnReset.fire('click');
  assert.equal(e.resetDialog.open, true);
  app.window.fire('keydown', {key: 'Enter', ctrlKey: true});
  assert.equal(e.stage.hidden, true);
  e.btnCancelReset.fire('click');
  assert.equal(e.resetDialog.open, false);
  assert.equal(e.script.value, 'Keep until confirmed');
  assert.equal(app.stored().text, 'Keep until confirmed');
  e.btnReset.fire('click');
  e.btnConfirmReset.fire('click');
  assert.equal(e.resetDialog.open, false);
  assert.equal(e.script.value, '');
  assert.equal(app.stored().text, '');
  assert.equal(app.stored().size, 72);
  assert.equal(app.stored().speed, 30);
  assert.equal(app.stored().bright, 85);
  assert.equal(app.stored().mirrorH, true);
  assert.equal(e.wordCount.textContent, '0 words');
  assert.equal(e.btnMode.disabled, true);
  assert.equal(e.btnExport.disabled, true);
  assert.equal(e.btnReset.disabled, true);
  assert.equal(app.document.activeElement, e.script);
  assert.equal(boot(JSON.stringify(app.stored())).elements.script.value, '');
});


test('intro script appears for new visitors without replacing saved or cleared drafts', () => {
  const firstVisit = boot(null);
  assert.match(firstVisit.elements.script.value, /open source teleprompter by Waldo Webster/);
  assert.equal(firstVisit.elements.btnMode.disabled, false);
  assert.equal(firstVisit.stored().text, firstVisit.elements.script.value);
  firstVisit.elements.btnMode.fire('click');
  assert.equal(firstVisit.elements.stage.hidden, false);
  assert.ok(firstVisit.elements.content.children.some(p => p.textContent.includes('Waldo Webster')));
  assert.equal(boot('{"text":"My own script"}').elements.script.value, 'My own script');
  assert.equal(boot('{"text":""}').elements.script.value, '');
});


test('welcome copy refresh preserves edited scripts and intentionally empty drafts', () => {
  const current = boot().elements.script.value;
  assert.ok(!current.includes('Find Waldo at waldo.biz.'));
  const previous = current.replace('on GitHub.', 'on GitHub. Find Waldo at waldo.biz.');
  assert.equal(boot(JSON.stringify({text: previous})).elements.script.value, current);
  const edited = previous + '\nMy own ending.';
  assert.equal(boot(JSON.stringify({text: edited})).elements.script.value, edited);
  assert.equal(boot('{"text":""}').elements.script.value, '');
});
