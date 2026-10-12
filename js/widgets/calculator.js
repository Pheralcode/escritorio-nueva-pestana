/**
 * Widget: calculadora.
 *
 * Evaluador propio (shunting-yard + RPN). No usamos `eval` ni `new Function`:
 * la CSP de MV3 los prohíbe y, aunque no lo hiciera, no hace falta.
 */

import { h } from '../core/dom.js';

const OPS = {
  '+': { prec: 1, apply: (a, b) => a + b },
  '-': { prec: 1, apply: (a, b) => a - b },
  '*': { prec: 2, apply: (a, b) => a * b },
  '/': { prec: 2, apply: (a, b) => (b === 0 ? NaN : a / b) },
  // Negación unaria: precedencia por encima de * y /, y asociativa por la
  // derecha. Sin esto, "3*-2" se evaluaría como (3*0)-2 en vez de 3*(-2).
  'u-': { prec: 3, unary: true, rightAssoc: true, apply: (a) => -a },
};

export function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const s = String(expr).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let num = '';
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push({ type: 'num', value: Number(num) });
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') {
      // Un signo menos al principio, tras otro operador o tras "(" es unario.
      const prev = tokens[tokens.length - 1];
      const unary = c === '-' && (!prev || prev.type === 'op' || (prev.type === 'paren' && prev.value === '('));
      tokens.push({ type: 'op', value: unary ? 'u-' : c });
      i++;
      continue;
    }
    if (c === '(' || c === ')') { tokens.push({ type: 'paren', value: c }); i++; continue; }
    if (c === '%') { tokens.push({ type: 'pct' }); i++; continue; }
    return null;   // carácter no reconocido
  }
  return tokens;
}

export function evaluate(expr) {
  const tokens = tokenize(expr);
  if (!tokens || !tokens.length) return null;

  const output = [];
  const stack = [];
  for (const t of tokens) {
    if (t.type === 'num') output.push(t.value);
    else if (t.type === 'pct') { const v = output.pop(); output.push(v / 100); }
    else if (t.type === 'op') {
      const cur = OPS[t.value];
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (!(top in OPS)) break;
        // Los operadores asociativos por la derecha solo ceden ante otros de
        // precedencia estrictamente mayor.
        const cede = cur.rightAssoc ? OPS[top].prec > cur.prec : OPS[top].prec >= cur.prec;
        if (!cede) break;
        output.push(stack.pop());
      }
      stack.push(t.value);
    } else if (t.value === '(') stack.push('(');
    else {
      while (stack.length && stack[stack.length - 1] !== '(') output.push(stack.pop());
      if (!stack.length) return null;   // paréntesis desbalanceado
      stack.pop();
    }
  }
  while (stack.length) {
    const op = stack.pop();
    if (op === '(') return null;
    output.push(op);
  }

  const calc = [];
  for (const item of output) {
    if (typeof item === 'number') { calc.push(item); continue; }
    const op = OPS[item];
    if (op.unary) {
      const a = calc.pop();
      if (a === undefined) return null;
      calc.push(op.apply(a));
      continue;
    }
    const b = calc.pop();
    const a = calc.pop();
    if (a === undefined || b === undefined) return null;
    calc.push(op.apply(a, b));
  }
  if (calc.length !== 1) return null;
  const result = calc[0];
  return Number.isFinite(result) ? result : null;
}

export function formatResult(n) {
  if (n == null) return '';
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

const KEYS = [
  ['C', '(', ')', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '%', '='],
];

export default {
  type: 'calculator',
  name: 'Calculadora',
  description: 'Operaciones rápidas.',
  icon: 'wcalc',
  sizes: ['sm', 'md'],
  defaultSize: 'sm',
  defaultConfig: {},

  create(ctx) {
    let expr = '';
    const display = h('div', { class: 'calc__display' }, h('span', { class: 'calc__expr' }, '0'));
    const pad = h('div', { class: 'calc__pad' });
    const el = h('div', { class: 'calc' }, display, pad);

    function paint(preview) {
      const exprEl = h('span', { class: 'calc__expr' }, expr || '0');
      const kids = [exprEl];
      if (preview != null && expr) kids.push(h('span', { class: 'calc__preview' }, `= ${formatResult(preview)}`));
      display.replaceChildren(...kids);
    }

    function press(key) {
      if (key === 'C') { expr = ''; paint(); return; }
      if (key === '=') {
        const value = evaluate(expr);
        expr = value == null ? '' : formatResult(value);
        paint();
        if (value == null) { display.classList.add('is-error'); setTimeout(() => display.classList.remove('is-error'), 400); }
        return;
      }
      expr += key;
      paint(evaluate(expr));
    }

    for (const row of KEYS) {
      for (const key of row) {
        const isOp = '÷×-+='.includes(key);
        pad.append(h('button', {
          class: `calc__key${isOp ? ' calc__key--op' : ''}${key === 'C' ? ' calc__key--clear' : ''}`,
          type: 'button',
          onClick: () => press(key),
        }, key));
      }
    }

    // Teclado físico cuando el widget tiene el foco.
    el.tabIndex = 0;
    el.addEventListener('keydown', (ev) => {
      const k = ev.key;
      if (/^[0-9.+\-*/()%]$/.test(k)) { ev.preventDefault(); press(k === '*' ? '×' : k === '/' ? '÷' : k); }
      else if (k === 'Enter' || k === '=') { ev.preventDefault(); press('='); }
      else if (k === 'Escape') { ev.preventDefault(); press('C'); }
      else if (k === 'Backspace') { ev.preventDefault(); expr = expr.slice(0, -1); paint(evaluate(expr)); }
    });

    paint();
    return { el };
  },
};
