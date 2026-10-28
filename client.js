/**
 * DSH 轮次手风琴（整轮折叠 / 提问单行摘要 / 日期时间）
 *
 * 行为（全工作区 / 全会话）：
 *   1. 收敛态：每个历史交互压成一行卡片 —— 左侧时间胶囊（MM-DD HH:mm）+ 单行提问摘要（省略号）；
 *      执行过程、回答正文、气泡内其它内容全部隐藏；
 *   2. 点这一行 → 该轮展开（提问全文 + 回答正文 + 原生折叠的过程头，带淡入），其它展开轮收起；
 *      再点提问 → 收回一行；
 *   3. 执行过程由核心「回答结束后收起」负责，只有单独点过程头才展开。
 *
 * 时间来源（按优先级）：React fiber 的 `props.node.data.time` → 原生 `*_timeStart` 文本 → 无。
 *
 * 视觉：时间胶囊用 tabular-nums 保证数字等宽；行 hover 有底色与文字提亮；右侧 chevron 提示可点；
 *       展开时内容 0.16s 淡入（仅一次，不干扰流式输出）。
 *
 * 安全阀：结构认不出就不动作；异常只 warn；不改核心配置。
 */
window.__ModuleLoader__.load({
  id: '@local/auto-collapse',
  factory() {
    const STYLE_ID = 'dsh-auto-collapse-style';
    const FLOW_SEL = '[data-slot="conversation.chat.flow"]';
    const ITEM_SEL = '[data-chat-turn]';
    const HIDE_ATTR = 'data-ac-hidden';
    const LINE_ATTR = 'data-ac-line';
    const USER_ATTR = 'data-ac-user';
    const TEXT_ATTR = 'data-ac-text';
    const TIME_ATTR = 'data-ac-time';
    const FRESH_ATTR = 'data-ac-fresh';

    const CHEVRON = 'url("data:image/svg+xml,' +
      '%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2712%27%20height=%2712%27' +
      '%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%23909090%27' +
      '%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27' +
      '%3E%3Cpolyline%20points=%279%206%2015%2012%209%2018%27/%3E%3C/svg%3E")';

    const open = new Map();
    const textCache = new WeakMap();
    let pending = false;
    let started = false;

    function ensureStyle() {
      if (document.getElementById(STYLE_ID) !== null) return;
      const tag = document.createElement('style');
      tag.id = STYLE_ID;
      tag.textContent = [
        '[' + HIDE_ATTR + '="1"]{display:none!important}',

        '[' + LINE_ATTR + '="1"]{position:relative;height:2em;margin:1px 0;overflow:hidden;',
        '  cursor:pointer;border-radius:8px;transition:background-color .12s ease;',
        '  background-repeat:no-repeat;background-position:right 9px center;background-size:12px 12px;',
        '  background-image:' + CHEVRON + '}',
        '[' + LINE_ATTR + '="1"]>*{visibility:hidden!important}',

        '[' + LINE_ATTR + '="1"]::before{content:attr(' + TIME_ATTR + ');position:absolute;',
        '  left:8px;top:50%;transform:translateY(-50%);width:86px;text-align:center;',
        '  font-size:11px;line-height:18px;border-radius:999px;white-space:nowrap;',
        '  font-variant-numeric:tabular-nums;letter-spacing:.02em;',
        '  color:var(--dsw-alias-label-tertiary,#9aa0a6);',
        '  background:rgba(127,127,127,.16);pointer-events:none}',
        '[' + LINE_ATTR + '="1"]:not([' + TIME_ATTR + '])::before{content:none}',

        '[' + LINE_ATTR + '="1"]::after{content:attr(' + TEXT_ATTR + ');position:absolute;',
        '  left:104px;right:28px;top:50%;transform:translateY(-50%);',
        '  font-size:.92em;line-height:1.5em;white-space:nowrap;overflow:hidden;',
        '  text-overflow:ellipsis;color:var(--dsw-alias-label-secondary,#c9c9c9)}',
        '[' + LINE_ATTR + '="1"]:not([' + TIME_ATTR + '])::after{left:12px}',

        '[' + LINE_ATTR + '="1"]:hover{background-color:rgba(127,127,127,.10)}',
        '[' + LINE_ATTR + '="1"]:hover::after{color:var(--dsw-alias-label-primary,#fff)}',
        '[' + LINE_ATTR + '="1"]:active{background-color:rgba(127,127,127,.18)}',

        '@keyframes dsh-ac-fade{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}',
        '[' + FRESH_ATTR + '="1"]{animation:dsh-ac-fade .16s ease-out}',
      ].join('');
      (document.head || document.documentElement).appendChild(tag);
    }

    function findFlow() {
      const flows = document.querySelectorAll(FLOW_SEL);
      let best = null;
      let bestCount = 0;
      for (let i = 0; i < flows.length; i++) {
        const count = flows[i].querySelectorAll(ITEM_SEL).length;
        if (count > bestCount) {
          best = flows[i];
          bestCount = count;
        }
      }
      if (best !== null) return best;
      const items = document.querySelectorAll(ITEM_SEL);
      if (items.length === 0) return null;
      return items[0].parentElement;
    }

    function groups(flow) {
      const all = flow.querySelectorAll(ITEM_SEL);
      const out = [];
      const byId = new Map();
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el.closest(ITEM_SEL) !== el) continue;
        const id = el.getAttribute('data-chat-turn');
        if (!id) continue;
        let group = byId.get(id);
        if (group === undefined) {
          group = { id, items: [] };
          byId.set(id, group);
          out.push(group);
        }
        group.items.push(el);
      }
      return out;
    }

    function pick(group) {
      let process = null;
      for (let i = 0; i < group.items.length; i++) {
        const el = group.items[i];
        if (el.getAttribute('data-chat-flow-kind') !== 'turn-process') continue;
        if (process === null || el.querySelector('button[aria-expanded]') !== null) process = el;
      }
      let user = null;
      for (let i = 0; i < group.items.length; i++) {
        const el = group.items[i];
        if (el === process) continue;
        if (el.querySelector('[class*="_bubble"]') !== null) {
          user = el;
          break;
        }
      }
      if (user === null) {
        for (let i = 0; i < group.items.length; i++) {
          if (group.items[i] !== process) {
            user = group.items[i];
            break;
          }
        }
      }
      if (user === null) user = group.items[0];
      return {
        process,
        user,
        rest: group.items.filter(function (el) {
          return el !== user;
        }),
      };
    }

    function pad2(value) {
      return value < 10 ? '0' + value : String(value);
    }

    function fmtTime(value) {
      if (value === undefined || value === null) return '';
      let ms;
      if (value instanceof Date) ms = value.getTime();
      else if (typeof value === 'number') ms = value < 1e12 ? value * 1000 : value;
      else ms = new Date(String(value)).getTime();
      if (!isFinite(ms)) return '';
      const d = new Date(ms);
      if (isNaN(d.getTime())) return '';
      return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
        pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    function fiberTime(el) {
      let fiber = null;
      const keys = Object.keys(el);
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('__reactFiber$') === 0 || keys[i].indexOf('__reactInternalInstance$') === 0) {
          fiber = el[keys[i]];
          break;
        }
      }
      let depth = 0;
      while (fiber !== null && fiber !== undefined && depth < 40) {
        const props = fiber.memoizedProps;
        if (props !== null && typeof props === 'object') {
          if (props.node && props.node.data && props.node.data.time !== undefined) return props.node.data.time;
          if (props.time !== undefined && typeof props.time === 'number') return props.time;
        }
        fiber = fiber.return;
        depth += 1;
      }
      return undefined;
    }

    function clockText(user) {
      const clocks = user.querySelectorAll('[class*="_timeStart"],[class*="_timeEnd"]');
      for (let i = 0; i < clocks.length; i++) {
        const text = (clocks[i].textContent || '').trim();
        if (text) return text;
      }
      return '';
    }

    function stampOf(user, bubble) {
      const stamp = fmtTime(fiberTime(bubble !== null ? bubble : user));
      if (stamp) return stamp;
      const native = clockText(user);
      if (!native) return '';
      if (/^\d{1,2}[:：]\d{2}/.test(native)) {
        const now = new Date();
        return pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()) + ' ' + native;
      }
      return native;
    }

    function summaryOf(bubble, fallback) {
      const source = bubble !== null ? bubble : fallback;
      if (source === null) return '';
      const raw = source.textContent || '';
      const cached = textCache.get(source);
      if (cached !== undefined && cached.len === raw.length) return cached.text;
      let node = null;
      try {
        node = source.cloneNode(true);
      } catch (err) {
        node = null;
      }
      let text = raw;
      if (node !== null) {
        const junk = node.querySelectorAll('[class*="_actions"],[class*="_action"],[class*="_toolbar"]');
        for (let i = 0; i < junk.length; i++) {
          if (junk[i].parentNode !== null) junk[i].parentNode.removeChild(junk[i]);
        }
        text = node.textContent || '';
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (text.length > 180) text = text.slice(0, 180) + '…';
      textCache.set(source, { len: raw.length, text });
      return text;
    }

    function markFresh(el) {
      if (el.getAttribute(FRESH_ATTR) === '1') return;
      el.setAttribute(FRESH_ATTR, '1');
      setTimeout(function () {
        el.removeAttribute(FRESH_ATTR);
      }, 200);
    }

    function apply() {
      ensureStyle();
      const flow = findFlow();
      if (flow === null) return 0;
      const list = groups(flow);
      const alive = new Set(list.map(function (group) {
        return group.id;
      }));
      Array.from(open.keys()).forEach(function (id) {
        if (!alive.has(id)) open.delete(id);
      });
      for (let i = 0; i < list.length; i++) {
        const group = list[i];
        let expanded = open.get(group.id);
        if (expanded === undefined) {
          expanded = i === list.length - 1;
          open.set(group.id, expanded);
        }
        const parts = pick(group);
        const user = parts.user;
        if (user !== null) {
          user.setAttribute(USER_ATTR, '1');
          user.removeAttribute(HIDE_ATTR);
          if (expanded) {
            user.removeAttribute(LINE_ATTR);
            user.removeAttribute(TEXT_ATTR);
            user.removeAttribute(TIME_ATTR);
          } else {
            const bubble = user.querySelector('[class*="_bubble"]');
            user.setAttribute(LINE_ATTR, '1');
            const stamp = stampOf(user, bubble);
            if (stamp) user.setAttribute(TIME_ATTR, stamp);
            else user.removeAttribute(TIME_ATTR);
            const body = summaryOf(bubble, user);
            user.setAttribute(TEXT_ATTR, body || '（无正文）');
          }
        }
        for (let j = 0; j < parts.rest.length; j++) {
          const el = parts.rest[j];
          if (expanded) {
            if (el.hasAttribute(HIDE_ATTR)) {
              el.removeAttribute(HIDE_ATTR);
              markFresh(el);
            }
          } else {
            el.setAttribute(HIDE_ATTR, '1');
          }
        }
      }
      return list.length;
    }

    function toggle(el) {
      const id = el.getAttribute('data-chat-turn');
      if (!id) return;
      const now = open.get(id) === true;
      open.set(id, !now);
      apply();
    }

    function onClick(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('a,button') !== null) return;
      const line = target.closest('[' + LINE_ATTR + '="1"]');
      if (line !== null) {
        event.preventDefault();
        toggle(line);
        return;
      }
      const user = target.closest('[' + USER_ATTR + '="1"]');
      if (user === null) return;
      const selection = window.getSelection();
      if (selection !== null && String(selection).length > 0) return;
      toggle(user);
    }

    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        try {
          apply();
        } catch (err) {
          console.warn('[auto-collapse] apply failed', err);
        }
      });
    }

    function report() {
      const flow = findFlow();
      if (flow === null) return { flow: false };
      return {
        flow: true,
        turns: groups(flow).map(function (group) {
          const parts = pick(group);
          const bubble = parts.user === null ? null : parts.user.querySelector('[class*="_bubble"]');
          return {
            id: group.id,
            expanded: open.get(group.id) === true,
            stamp: parts.user === null ? '' : stampOf(parts.user, bubble),
            summary: parts.user === null ? '' : summaryOf(bubble, parts.user).slice(0, 60),
            items: group.items.length,
          };
        }),
      };
    }

    function start() {
      if (started) return;
      started = true;
      ensureStyle();
      document.addEventListener('click', onClick, true);
      try {
        new MutationObserver(schedule).observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      } catch (err) {
        console.warn('[auto-collapse] observer unavailable', err);
      }
      setInterval(schedule, 1500);
      setTimeout(schedule, 300);
      window.__acReport = report;
      console.info('[auto-collapse] ready — window.__acReport() 查看结构诊断');
    }

    return {
      inject: [],
      apply() {
        try {
          start();
        } catch (err) {
          console.warn('[auto-collapse] start failed', err);
        }
      },
    };
  },
});
