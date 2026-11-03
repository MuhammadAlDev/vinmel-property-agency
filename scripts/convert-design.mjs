// Converts the .dc.html design (template + logic class) into a React client component.
// Usage: node convert.mjs <Main.dc.html> <assetDir> <outJsx> <outCss>
import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'htmlparser2';

const [src, assetDir, outJsx, outCss] = process.argv.slice(2);
let html = fs.readFileSync(src, 'utf8');

// Map /_blob/<id> -> /assets/<id>.<ext>
const files = fs.readdirSync(assetDir);
html = html.replace(/\/_blob\/([a-f0-9]{32})/g, (m, id) => {
  const f = files.find((n) => n.startsWith(id + '.'));
  if (!f) throw new Error('missing asset ' + id);
  return '/assets/' + f;
});

const xStart = html.indexOf('<x-dc>');
const xEnd = html.indexOf('</x-dc>');
let inner = html.slice(xStart + 6, xEnd);
const hStart = inner.indexOf('<helmet>');
const hEnd = inner.indexOf('</helmet>');
const helmet = inner.slice(hStart + 8, hEnd);
inner = inner.slice(0, hStart) + inner.slice(hEnd + 9);

const css = helmet.match(/<style>([\s\S]*?)<\/style>/)[1];
fs.writeFileSync(outCss, css.trim() + '\n');

const sStart = html.indexOf('<script type="text/x-dc"');
const sBodyStart = html.indexOf('>', sStart) + 1;
const sEnd = html.indexOf('</script>', sBodyStart);
let logic = html.slice(sBodyStart, sEnd).trim();
logic = logic.replace(/^class Component extends DCLogic \{/, 'class DesignComponent extends React.Component {');

const doc = parseDocument(inner, {
  lowerCaseTags: false,
  lowerCaseAttributeNames: false,
  recognizeSelfClosing: true,
  decodeEntities: true,
});

const ATTR_MAP = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly',
  maxlength: 'maxLength', minlength: 'minLength', autocomplete: 'autoComplete',
  inputmode: 'inputMode', colspan: 'colSpan', rowspan: 'rowSpan', autofocus: 'autoFocus',
  enterkeyhint: 'enterKeyHint', spellcheck: 'spellCheck', crossorigin: 'crossOrigin',
  novalidate: 'noValidate', contenteditable: 'contentEditable', srcset: 'srcSet',
  'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace', allowfullscreen: 'allowFullScreen',
  frameborder: 'frameBorder', datetime: 'dateTime', enctype: 'encType', accesskey: 'accessKey',
  playsinline: 'playsInline', referrerpolicy: 'referrerPolicy', fetchpriority: 'fetchPriority',
  'accept-charset': 'acceptCharset', 'http-equiv': 'httpEquiv',
};
const NO_WS_PARENTS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'select', 'optgroup', 'svg', 'g', 'defs', 'linearGradient', 'radialGradient', 'clipPath', 'mask', 'pattern', 'symbol', 'textarea']);
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'ellipse', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'text', 'tspan', 'use', 'symbol', 'pattern', 'title']);

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function ref(p, scope) {
  p = p.trim();
  if (p === 'true' || p === 'false' || p === 'null' || /^-?\d+(\.\d+)?$/.test(p)) return p;
  if (/^'.*'$/.test(p) || /^".*"$/.test(p)) return p;
  if (!/^[A-Za-z_$][\w$]*(\.[\w$]+)*$/.test(p)) throw new Error('bad hole: ' + p);
  const segs = p.split('.');
  const head = scope.includes(segs[0]) ? segs[0] : 'v.' + segs[0];
  return head + segs.slice(1).map((s) => (/^\d+$/.test(s) ? `?.[${s}]` : '?.' + s)).join('');
}

const HOLE = /\{\{([\s\S]*?)\}\}/g;
// value expression for attribute/text containing holes
function interp(str, scope, { raw = true } = {}) {
  const whole = str.match(/^\s*\{\{([^}]*)\}\}\s*$/);
  if (whole && raw) return { expr: ref(whole[1], scope), dynamic: true };
  if (!HOLE.test(str)) { HOLE.lastIndex = 0; return { expr: JSON.stringify(str), dynamic: false, literal: str }; }
  HOLE.lastIndex = 0;
  let out = '`';
  let last = 0;
  for (const m of str.matchAll(HOLE)) {
    out += str.slice(last, m.index).replace(/[`\\$]/g, (c) => '\\' + c);
    out += '${' + `(${ref(m[1], scope)}) ?? ''` + '}';
    last = m.index + m[0].length;
  }
  out += str.slice(last).replace(/[`\\$]/g, (c) => '\\' + c) + '`';
  return { expr: out, dynamic: true };
}

function splitDecls(css) {
  const out = [];
  let depth = 0, quote = null, cur = '', inHole = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (css.startsWith('{{', i)) { inHole++; cur += '{{'; i++; continue; }
    if (css.startsWith('}}', i) && inHole) { inHole--; cur += '}}'; i++; continue; }
    if (quote) { if (c === quote) quote = null; cur += c; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ';' && depth === 0 && !inHole) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map((d) => d.trim()).filter(Boolean);
}

function styleExpr(css, scope) {
  const parts = [];
  for (const decl of splitDecls(css)) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    let prop = decl.slice(0, i).trim();
    let val = decl.slice(i + 1).trim();
    let important = false;
    if (/!important$/.test(val)) { important = true; val = val.replace(/\s*!important$/, ''); }
    if (important) throw new Error('!important in inline style unsupported: ' + decl);
    let key;
    if (prop.startsWith('--')) key = JSON.stringify(prop);
    else if (prop.startsWith('-')) { key = camel(prop.slice(1)); key = key[0].toUpperCase() + key.slice(1); if (key.startsWith('Ms')) key = 'ms' + key.slice(2); }
    else key = camel(prop);
    const { expr } = interp(val, scope, { raw: false });
    parts.push(`${key}: ${expr}`);
  }
  return `{{ ${parts.join(', ')} }}`;
}

function attrName(name, tag) {
  if (ATTR_MAP[name]) return ATTR_MAP[name];
  if (/^(aria|data)-/.test(name)) return name;
  if (/^on[A-Z]/.test(name)) return name;
  if (name.includes('-') || name.includes(':')) return camel(name.replace(':', '-'));
  return name;
}

function attrsJsx(el, scope) {
  const out = [];
  for (const [name, value] of Object.entries(el.attribs)) {
    if (name.startsWith('hint-')) continue;
    if (name === 'style') { out.push(`style=${styleExpr(value, scope)}`); continue; }
    const n = attrName(name, el.name);
    if (value === '' && ['disabled', 'checked', 'selected', 'readonly', 'required', 'multiple', 'autofocus', 'hidden', 'open', 'novalidate', 'playsinline', 'muted', 'autoplay', 'loop', 'controls', 'allowfullscreen', 'defer', 'async'].includes(name)) {
      out.push(`${n}={true}`); continue;
    }
    const r = interp(value, scope);
    if (!r.dynamic) out.push(`${n}=${JSON.stringify(value)}`.replace(/^([^=]+)=(".*")$/s, (m, a, b) => `${a}={${b}}`));
    else out.push(`${n}={${r.expr}}`);
  }
  return out.join(' ');
}

function textJsx(text, scope, parentTag) {
  if (!text) return '';
  if (/^\s*$/.test(text)) {
    if (NO_WS_PARENTS.has(parentTag)) return '';
    return '{" "}';
  }
  // collapse whitespace like HTML does for runs (keeps rendering identical in normal white-space)
  let out = '';
  let last = 0;
  for (const m of text.matchAll(HOLE)) {
    const s = text.slice(last, m.index);
    if (s) out += `{${JSON.stringify(s)}}`;
    out += `{${ref(m[1], scope)}}`;
    last = m.index + m[0].length;
  }
  const s = text.slice(last);
  if (s) out += `{${JSON.stringify(s)}}`;
  return out;
}

function nodeJsx(node, scope, parentTag) {
  if (node.type === 'text') return textJsx(node.data, scope, parentTag);
  if (node.type === 'comment') return '';
  if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') return '';
  const tag = node.name;
  if (tag === 'sc-if') {
    const cond = interp(node.attribs.value, scope).expr;
    return `{(${cond}) ? (<>${childrenJsx(node, scope, parentTag)}</>) : null}`;
  }
  if (tag === 'sc-for') {
    const list = interp(node.attribs.list, scope).expr;
    const as = node.attribs.as;
    const inner = [...scope, as, '$index'];
    return `{((${list}) || []).map((${as}, $index) => (<React.Fragment key={$index}>${childrenJsx(node, inner, parentTag)}</React.Fragment>))}`;
  }
  if (tag.includes('-')) throw new Error('unknown custom tag ' + tag);
  const attrs = attrsJsx(node, scope);
  const open = `<${tag}${attrs ? ' ' + attrs : ''}`;
  if (tag === 'textarea') return `${open} />`;
  const kids = childrenJsx(node, scope, tag);
  if (!kids) return `${open} />`;
  return `${open}>${kids}</${tag}>`;
}

function childrenJsx(node, scope, tag) {
  return node.children.map((c) => nodeJsx(c, scope, tag)).join('');
}

const roots = doc.children.filter((c) => !(c.type === 'text' && /^\s*$/.test(c.data)) && c.type !== 'comment');
const body = roots.map((c) => nodeJsx(c, [], 'div')).join('\n');

const out = `'use client';
/* eslint-disable */
// AUTO-GENERATED from the Vinmel Agency design (Main.dc.html) by scripts/convert-design.mjs.
// Markup and logic are kept 1:1 with the design so the site looks and behaves exactly the same.
import React from 'react';

${logic.replace(/\n  renderVals\(\) \{/, () => '\n  render() {\n    const v = this.renderVals();\n    return (\n' + body + '\n    );\n  }\n  renderVals() {')}

export default DesignComponent;
`;
fs.writeFileSync(outJsx, out);
console.log('ok', out.length);
