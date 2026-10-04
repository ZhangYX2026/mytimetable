/* ============================================================
   课程表 —— 逻辑
   ------------------------------------------------------------
   数据层  ：课表 + 作息 + 节假日，存在 localStorage
   看板    ：此刻在上什么课、下一节是什么
   总课表  ：行=节次、列=星期，点格子改课
   日历    ：月历 + 节假日 + 当天有什么课
   作息设置：第 1 节几点开始、每节多长、课间与午休、学期第一周
   ============================================================ */

/* 调试参数：#diag 显示自检信息；#view/#cal 展开面板；#cell=1-2 直接开编辑；
   #mock=2026-10-05T09:12 假装某个时刻；#seed=[1,2] 写入测试数据 */
function paramText() {
  const hash = location.hash ? location.hash.replace(/^#/, '') : '';
  return (location.search || '').replace(/^\?/, '') + (hash ? '&' + hash : '');
}
function qp(key) {
  const hit = new RegExp('(?:^|&)' + key + '=([^&]*)').exec(paramText());
  return hit ? decodeURIComponent(hit[1]) : null;
}
function has(key) {
  return new RegExp('(?:^|&)' + key + '(?:=|&|$)').test(paramText());
}

/* 启动自检：只有 #diag 时才显示到页面上 */
const BOOT = { on: false, steps: [], errors: [] };
function boot(msg) { BOOT.steps.push(msg); paintBoot(); }

/* 每门课的颜色表：课名 → 色相（在下面第 5 节里维护，这里先声明避免顺序问题） */
let hueMap = new Map();
function paintBoot() {
  if (!BOOT.on) return;
  const el = document.getElementById('boot');
  if (!el) return;
  let text = '';
  if (BOOT.errors.length) text += '⚠ 页面报错: ' + BOOT.errors.join(' ; ') + '   ';
  text += '启动步骤: ' + BOOT.steps.join(' → ');
  el.textContent = text;
}
window.addEventListener('error', (e) => {
  if (e.target && e.target !== window && e.target.tagName) {
    BOOT.errors.push('资源加载失败 ' + (e.target.src || e.target.tagName));
  } else {
    BOOT.errors.push((e.message || '未知') + ' @' + (e.filename || '?') + ':' + (e.lineno || '?'));
  }
  paintBoot();
});
BOOT.on = has('diag');
boot('脚本开始');

/* ---------------- 1. 数据层 ---------------- */

const STORAGE_KEY = 'my-timetable.v1';
const DOW_CN = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_CN = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEK_LABEL = { all: '', odd: '单周', even: '双周' };

function defaultSettings() {
  const s = {
    periods: 12,
    startMin: 8 * 60,
    periodMin: 45,
    breaks: [5, 5, 5, 50, 5, 5, 5, 5, 5, 5, 5],
    termStart: '2026-09-07'          // 学期第 1 周的周一（用来算单双周）
  };
  s.periodTimes = buildTimesFrom(s);  // 每节课的起止时间（分钟数，可逐节改）
  return s;
}

// 由「第 1 节开始 + 每节长度 + 各课间」推出每节课的起止时间
function buildTimesFrom(s) {
  const out = [];
  let cursor = s.startMin;
  for (let p = 1; p <= s.periods; p++) {
    out.push({ start: cursor, end: cursor + s.periodMin });
    cursor += s.periodMin + (s.breaks[p - 1] || 0);
  }
  return out;
}

const DEFAULT_DATA = {
  version: 1,
  settings: defaultSettings(),
  holidays: [
    { date: '2026-10-01', name: '国庆节' },
    { date: '2026-10-02', name: '国庆假期' },
    { date: '2026-10-03', name: '国庆假期' }
  ],
  makeups: [],
  events: [],
  courses: [
    { day: 1, period: 1, name: '高等数学 A', teacher: '李国强', room: '教三 305', hue: 210, weeks: 'all', note: '上课会点名，最好别迟到。板书快，建议提前预习。' },
    { day: 1, period: 2, name: '高等数学 A', teacher: '李国强', room: '教三 305', hue: 210, weeks: 'all', note: '同上，两节连上。' },
    { day: 1, period: 3, name: '大学英语', teacher: '王敏', room: '外语楼 210', hue: 25, weeks: 'all', note: '要带听力耳机，课堂上会抽查朗读。' },
    { day: 1, period: 5, name: '程序设计基础', teacher: '张伟', room: '机房 A 402', hue: 275, weeks: 'all', note: '老师喜欢自己动手敲代码，作业当堂交。' },
    { day: 1, period: 6, name: '程序设计基础', teacher: '张伟', room: '机房 A 402', hue: 275, weeks: 'all', note: '同上。' },
    { day: 1, period: 10, name: '晚自习', teacher: '辅导员', room: '教一 108', hue: 320, weeks: 'all', note: '18:30 开始签到。' },

    { day: 2, period: 1, name: '线性代数', teacher: '陈立', room: '教三 208', hue: 160, weeks: 'all', note: '不点名，但期末给分看平时作业。' },
    { day: 2, period: 3, name: '计算机导论', teacher: '刘洋', room: '教二 501', hue: 140, weeks: 'all', note: '老师会讲很多行业八卦，值得听。' },
    { day: 2, period: 4, name: '计算机导论', teacher: '刘洋', room: '教二 501', hue: 140, weeks: 'all', note: '同上。' },
    { day: 2, period: 7, name: '体育（篮球）', teacher: '赵刚', room: '东体育馆', hue: 45, weeks: 'all', note: '穿运动鞋，迟到要罚跑一圈。' },

    { day: 3, period: 2, name: '大学物理', teacher: '孙梅', room: '教二 305', hue: 190, weeks: 'all', note: '讲得快，建议坐前排。' },
    { day: 3, period: 3, name: '大学物理', teacher: '孙梅', room: '教二 305', hue: 190, weeks: 'all', note: '同上。' },
    { day: 3, period: 5, name: '数据结构', teacher: '周凯', room: '机房 A 401', hue: 25, weeks: 'all', note: '实验课，助教在，可以随便问。' },
    { day: 3, period: 6, name: '数据结构', teacher: '周凯', room: '机房 A 401', hue: 25, weeks: 'all', note: '同上。' },
    { day: 3, period: 9, name: '形势与政策', teacher: '马丽', room: '教一 302', hue: 45, weeks: 'even', note: '双周才上，偶尔点名，写点笔记就行。' },

    { day: 4, period: 1, name: '离散数学', teacher: '吴强', room: '教三 401', hue: 320, weeks: 'all', note: '作业每周交一次，别拖到最后。' },
    { day: 4, period: 2, name: '离散数学', teacher: '吴强', room: '教三 401', hue: 320, weeks: 'all', note: '同上。' },
    { day: 4, period: 4, name: '大学英语', teacher: '王敏', room: '外语楼 210', hue: 25, weeks: 'all', note: '这节课常做小组展示。' },
    { day: 4, period: 7, name: '心理健康', teacher: '何静', room: '教一 205', hue: 45, weeks: 'all', note: '很轻松的课，会做一些小测试。' },
    { day: 4, period: 11, name: '社团活动', teacher: '（自定）', room: '学生活动中心', hue: 25, weeks: 'odd', note: '单周才有，编程社，一起做小项目。' },

    { day: 5, period: 2, name: '概率论', teacher: '郑海', room: '教三 306', hue: 275, weeks: 'all', note: '老师喜欢提问，但答错不扣分。' },
    { day: 5, period: 3, name: '马克思主义基本原理', teacher: '许文', room: '教一 401', hue: 160, weeks: 'all', note: '期末开卷，平时可以放松点。' },
    { day: 5, period: 4, name: '马克思主义基本原理', teacher: '许文', room: '教一 401', hue: 160, weeks: 'all', note: '同上。' },
    { day: 5, period: 8, name: '程序设计实验', teacher: '张伟', room: '机房 A 402', hue: 210, weeks: 'all', note: '要把当周的实验报告交上去才走。' },

    { day: 6, period: 9, name: '选修：人工智能入门', teacher: '林涛', room: '教二 108', hue: 210, weeks: 'all', note: '很有意思，但作业要跑模型，电脑要好一点。' }
  ]
};

let data = null;
let editMode = false;
let storageOK = true;
let savedFlag = false;
let courseIndex = 0;          // 用来把默认颜色散开（下面第 5 节会用到）

function cloneDefault() { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }

/* 只负责把存档读出来，不碰任何状态变量 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.settings && Array.isArray(parsed.courses)) return parsed;
  } catch (e) {
    console.warn('读不到本地存储：', e);
  }
  return null;
}

function ensureSettings(s) {
  s = Object.assign(defaultSettings(), s);
  // 老存档只有 breaks 没有 periodTimes：按老规则推一遍
  if (!Array.isArray(s.periodTimes) || s.periodTimes.length < s.periods
      || s.periodTimes.some((t) => !t || typeof t.start !== 'number' || typeof t.end !== 'number')) {
    s.periodTimes = buildTimesFrom(s);
  }
  return s;
}

function loadData() {
  const stored = loadFromStorage();
  if (!stored) return cloneDefault();
  savedFlag = true;
  // 补齐老版本存档缺的字段
  stored.settings = ensureSettings(stored.settings);
  if (!Array.isArray(stored.holidays)) stored.holidays = [];
  if (!Array.isArray(stored.makeups)) stored.makeups = [];
  if (!Array.isArray(stored.events)) stored.events = [];
  stored.courses.forEach((c) => { if (!c.weeks) c.weeks = 'all'; });
  return stored;
}

data = loadData();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    storageOK = true;
  } catch (e) {
    storageOK = false;
    console.warn('写不进本地存储：', e);
  }
  renderSaveHint();
}

function renderSaveHint() {
  const box = document.getElementById('save-hint');
  if (storageOK) {
    box.hidden = true;
  } else {
    box.hidden = false;
    box.textContent = '注意：这个浏览器不允许本地文件保存数据，你的修改在刷新后会丢掉。请双击「打开课程表.cmd」用本地服务器打开。';
  }
  renderDiag();
}

const DIAG = has('diag');

function renderDiag() {
  if (!DIAG) return;
  const el = document.getElementById('diag');
  el.hidden = false;
  let raw = 'null';
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = 'ERROR:' + e.name; }
  const t = currentTime();
  el.textContent = 'DIAG 存档=' + (savedFlag ? '已载入' : '新建')
    + ' | 可写=' + (storageOK ? '是' : '否')
    + ' | 课程数=' + data.courses.length
    + ' | 节假日=' + data.holidays.length
    + ' | 现在=' + t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate())
    + ' 周' + DOW_CN[t.getDay()] + ' ' + pad2(t.getHours()) + ':' + pad2(t.getMinutes())
    + ' 第' + weekNumber(t) + '周(' + weekKind(t) + ')'
    + ' | 课间=' + (data.settings.breaks || []).join('/')
    + ' | 节次时间=' + periodRange(1).start + '-' + periodRange(data.settings.periods).end
    + ' | 有事=' + (data.events || []).length
    + ' | 调休=' + (data.makeups || []).length
    + ' | 今天课数=' + coursesOn(t).length
    + ' | 当前课=' + diagNowText()
    + ' | 存档字节=' + (raw ? raw.length : 'null');
}

/* ---------------- 2. 时间与周次 ---------------- */

function pad2(n) { return String(n).padStart(2, '0'); }
function dayOfWeek(date) { const d = date.getDay(); return d === 0 ? 7 : d; }
function minutesOfDay(date) { return date.getHours() * 60 + date.getMinutes(); }
function minToText(min) {
  const v = ((min % 1440) + 1440) % 1440;
  return pad2(Math.floor(v / 60)) + ':' + pad2(v % 60);
}
function textToMin(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function formatDuration(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return m + ' 分钟';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? h + ' 小时 ' + rest + ' 分' : h + ' 小时';
}
function dateKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}
function parseDateKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }

/* 调试用「假装现在几点」：
   #time=09:20              只改时间，星期几还是今天
   #mock=2026-10-05T09:12   日期和时间一起改（周一 09:12）
   去掉参数就恢复真实时间。 */
const MOCK = (() => {
  const full = /^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})$/.exec((qp('mock') || '').trim());
  if (full) return { y: +full[1], mo: +full[2] - 1, d: +full[3], h: +full[4], mi: +full[5] };
  const part = /^(\d{1,2}):(\d{2})$/.exec((qp('time') || '').trim());
  if (part) return { h: +part[1], mi: +part[2] };
  return null;
})();

function currentTime() {
  const now = new Date();
  if (!MOCK) return now;
  if (MOCK.y !== undefined) now.setFullYear(MOCK.y, MOCK.mo, MOCK.d);
  now.setHours(MOCK.h, MOCK.mi, 0, 0);
  return now;
}

// 距离学期第 1 周周一过了几周（负数=还没开学）
function weekOffset(date) {
  const term = parseDateKey(data.settings.termStart);
  if (!term) return 0;
  const termMonday = startOfDay(term);
  const day = startOfDay(date);
  return Math.floor((day - termMonday) / (7 * 86400000));
}
function weekNumber(date) { return weekOffset(date) + 1; }
function weekKind(date) { return weekNumber(date) % 2 === 0 ? 'even' : 'odd'; }

/* ---------------- 3. 课表推算（含单双周过滤） ---------------- */

function periodRange(period) {
  const times = data.settings.periodTimes;
  const t = times && times[period - 1];
  if (t && typeof t.start === 'number' && typeof t.end === 'number') return { start: t.start, end: t.end };
  // 兜底：按老规则算
  const s = data.settings;
  let start = s.startMin;
  for (let i = 1; i < period; i++) start += s.periodMin + (s.breaks[i - 1] || 0);
  return { start, end: start + s.periodMin };
}

/* ---------------- 3b. 临时事件（有事） ---------------- */

function eventsOn(date) {
  const key = dateKey(date);
  return (data.events || []).filter((e) => e.date === key).sort((a, b) => a.start - b.start);
}
function eventAt(date, minute) {
  return eventsOn(date).find((e) => minute >= e.start && minute < e.end) || null;
}
function eventById(id) {
  return (data.events || []).find((e) => e.id === id) || null;
}

// 某个时间段撞上了哪些课（含单双周判断）
function conflictsFor(key, start, end) {
  const date = parseDateKey(key);
  if (!date) return [];
  const out = [];
  coursesOn(date).forEach((c) => {
    const r = periodRange(c.period);
    if (r.start < end && r.end > start) out.push({ course: c, range: r, overlap: Math.min(r.end, end) - Math.max(r.start, start) });
  });
  return out;
}

function courseMatchesWeek(course, date) {
  const w = course.weeks || 'all';
  if (w === 'all') return true;
  return w === weekKind(date);
}

function isWeekend(date) { return dayOfWeek(date) >= 6; }

/* 调休（补课）：两种
   mode = 'recurring'  按照"第几周的星期几"来上，比如"补第 3 周周一的课"
   mode = 'special'    临时课表，只在那一天额外上这些课                      */
function makeupOn(date) {
  const key = dateKey(date);
  return data.makeups.find((m) => m.date === key) || null;
}

function makeupCoursesFor(date) {
  const mk = makeupOn(date);
  if (!mk) return [];
  if (mk.mode === 'special') {
    return (mk.courses || []).slice().sort((a, b) => a.period - b.period);
  }
  // 参照周：mk.week 是周次，用它来判断单双周等
  const y = date.getFullYear();
  const ref = new Date(y, 0, 4 + (mk.week - 1) * 7);
  const refMonday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ((ref.getDay() + 6) % 7));
  const refDate = new Date(refMonday.getFullYear(), refMonday.getMonth(), refMonday.getDate() + (mk.weekday - 1));
  return data.courses
    .filter((c) => c.day === mk.weekday && courseMatchesWeek(c, refDate))
    .slice()
    .sort((a, b) => a.period - b.period);
}

function makeupLabel(mk) {
  if (!mk) return '';
  if (mk.mode === 'special') return '临时课表';
  return '补第 ' + mk.week + ' 周' + WEEK_CN[mk.weekday] + '的课';
}

// 这一天实际要上的课：调休优先，然后看节假日，最后是常规课表
function coursesOn(date) {
  const mk = makeupOn(date);
  if (mk) return makeupCoursesFor(date);
  if (isHoliday(date)) return [];
  return data.courses
    .filter((c) => c.day === dayOfWeek(date) && courseMatchesWeek(c, date))
    .sort((a, b) => a.period - b.period);
}

function findCurrent(now) {
  const p = minutesOfDay(now);
  for (const course of coursesOn(now)) {
    const { start, end } = periodRange(course.period);
    if (p >= start && p < end) return { course, start, end };
  }
  return null;
}

function findNext(now) {
  const p = minutesOfDay(now);
  for (let i = 0; i < 8; i++) {
    const probe = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const list = coursesOn(probe);
    let best = null;
    for (const course of list) {
      const { start, end } = periodRange(course.period);
      if (i === 0 && start < p) continue;
      if (!best || start < best.start) best = { course, start, end };
    }
    if (best) {
      return {
        course: best.course,
        start: best.start,
        end: best.end,
        dayOffset: i,
        date: probe,
        diffMin: best.start - p + i * 1440
      };
    }
  }
  return null;
}

function endOfPrevious(now) {
  const p = minutesOfDay(now);
  let latest = null;
  for (const course of coursesOn(now)) {
    const { end } = periodRange(course.period);
    if (end <= p && (latest === null || end > latest)) latest = end;
  }
  return latest;
}

/* ---------------- 4. 节假日 ---------------- */

function isHoliday(date) {
  const key = dateKey(date);
  return data.holidays.some((h) => h.date === key);
}
function holidayOf(date) {
  const key = dateKey(date);
  return data.holidays.find((h) => h.date === key) || null;
}
function addHoliday(key, name) {
  if (!parseDateKey(key)) return false;
  data.holidays = data.holidays.filter((h) => h.date !== key);
  data.holidays.push({ date: key, name: name || '节假日' });
  data.holidays.sort((a, b) => a.date.localeCompare(b.date));
  saveData();
  return true;
}
function removeHoliday(key) {
  data.holidays = data.holidays.filter((h) => h.date !== key);
  saveData();
}

/* ---------------- 5. 颜色：每门课一个色相，可自定义 ---------------- */

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003;
  return h;
}

// 自动分配：按课名散开，保证相邻课颜色差别明显
function hueFromName(name) {
  return (hashStr(String(name)) * 47 + courseIndex * 23) % 360;
}

function hueOf(course) {
  if (typeof course.hue === 'number') return ((course.hue % 360) + 360) % 360;
  return hueFromName(course.name);
}

// 同一门课在所有地方用同一个颜色：优先用你设过的颜色，否则按课名自动分配
function refreshHueMap() {
  const map = new Map();
  data.courses.forEach((c, i) => {
    if (map.has(c.name)) return;
    courseIndex = i;
    map.set(c.name, typeof c.hue === 'number' ? ((c.hue % 360) + 360) % 360 : hueFromName(c.name));
  });
  courseIndex = 0;
  hueMap = map;
}

function hueOfName(name) {
  return hueMap.has(name) ? hueMap.get(name) : 210;
}

// 自检用：把"当前正在上什么课"写成短字符串
function diagNowText() {
  const c = findCurrent(currentTime());
  if (!c) return '无';
  return c.course.name + ' 第' + c.course.period + '节';
}

/* ---------------- 6. 看板 ---------------- */

const $ = (id) => document.getElementById(id);

function renderNow(now, current, next) {
  const state = $('now-state');
  const name = $('now-name');
  const meta = $('now-meta');
  const note = $('now-note');
  const progress = $('now-progress');
  const bar = $('now-progress-bar');
  const block = document.querySelector('.block-now');
  const noteLabel = block.querySelector('.note-label');
  const ev = eventAt(now, minutesOfDay(now));

  // ① 有事优先：事件时间段内，大框显示"有事"的内容
  if (ev) {
    const conflicts = conflictsFor(dateKey(now), ev.start, ev.end);
    const p = minutesOfDay(now);
    const ratio = Math.min(1, Math.max(0, (p - ev.start) / Math.max(1, ev.end - ev.start)));
    block.classList.add('is-event');
    block.classList.remove('is-live');
    block.style.setProperty('--now-hue', '8');
    progress.hidden = false;
    bar.style.width = (ratio * 100).toFixed(1) + '%';
    state.textContent = '有事中 · ' + minToText(ev.start) + '–' + minToText(ev.end)
      + ' · 还剩 ' + formatDuration(ev.end - p);
    state.classList.add('is-live');
    name.textContent = ev.title || '有事';
    meta.textContent = minToText(ev.start) + '–' + minToText(ev.end)
      + (conflicts.length ? ' · 与 ' + conflicts.length + ' 节课冲突' : ' · 无冲突');
    if (noteLabel) noteLabel.textContent = conflicts.length ? '冲突的课' : '备注';
    if (conflicts.length) {
      note.textContent = conflicts.map((c) => '第 ' + c.course.period + ' 节 '
        + minToText(c.range.start) + '–' + minToText(c.range.end) + ' ' + c.course.name
        + (c.course.room ? ' · ' + c.course.room : '')
        + (c.course.weeks && c.course.weeks !== 'all' ? '（' + WEEK_LABEL[c.course.weeks] + '）' : '')
        + (c.course.teacher ? ' · ' + c.course.teacher : '')).join('\n');
    } else {
      note.textContent = ev.note || '（没有备注）';
    }
    return;
  }

  block.classList.remove('is-event');
  if (noteLabel) noteLabel.textContent = '备注';

  // ② 正在上课
  if (current) {
    const { course, start, end } = current;
    const p = minutesOfDay(now);
    const ratio = Math.min(1, Math.max(0, (p - start) / Math.max(1, end - start)));
    state.textContent = '正在上课 · 第 ' + course.period + ' 节 · 距下课 ' + formatDuration(end - p);
    state.classList.add('is-live');
    block.classList.add('is-live');
    block.style.setProperty('--now-hue', String(hueOfName(course.name)));
    name.textContent = course.name;
    meta.textContent = minToText(start) + '–' + minToText(end) + ' · ' + (course.teacher || '—') + ' · ' + (course.room || '—');
    note.textContent = course.note || '（没有备注）';
    progress.hidden = false;
    bar.style.width = (ratio * 100).toFixed(1) + '%';
    return;
  }

  block.classList.remove('is-live');
  block.style.removeProperty('--now-hue');
  progress.hidden = true;

  // ③ 还没到的"有事"：提前提醒，但大框仍然显示课
  const todayEvents = eventsOn(now).filter((e) => e.start >= minutesOfDay(now));
  const soon = todayEvents[0] || null;
  const soonText = soon
    ? ' · 今天 ' + minToText(soon.start) + (soon.end ? '–' + minToText(soon.end) : '') + ' 有事'
    : '';

  name.textContent = '没课，歇着';
  meta.textContent = '';
  note.textContent = '（没有备注）';
  state.classList.remove('is-live');

  const holiday = holidayOf(now);
  const mk = makeupOn(now);
  const mkCourses = mk ? makeupCoursesFor(now) : [];
  if (mk && mkCourses.length) {
    const nextMk = mkCourses.find((c) => periodRange(c.period).start >= minutesOfDay(now));
    state.textContent = '今天调休（' + makeupLabel(mk) + '）'
      + (nextMk ? ' · 下一节 ' + minToText(periodRange(nextMk.period).start) : ' · 已经上完了');
    return;
  }
  if (holiday) {
    state.textContent = '今天是' + holiday.name + '，休息';
    if (next) state.textContent += ' · 下次上课 ' + (next.date.getMonth() + 1) + '月' + next.date.getDate() + '日 '
      + WEEK_CN[dayOfWeek(next.date)] + ' ' + minToText(next.start);
    return;
  }
  if (isWeekend(now)) {
    state.textContent = next
      ? '周末 · 下次上课 ' + (next.date.getMonth() + 1) + '月' + next.date.getDate() + '日 '
        + WEEK_CN[dayOfWeek(next.date)] + ' ' + minToText(next.start) + '（' + formatDuration(next.diffMin) + '后）'
      : '周末 · 本周没有更多课程';
    return;
  }
  if (!next) {
    state.textContent = '本周没有更多课程';
    return;
  }
  const gap = next.diffMin;
  if (next.dayOffset === 0) {
    const prevEnd = endOfPrevious(now);
    if (prevEnd !== null && gap <= 120) {
      state.textContent = '刚下课 · 休息 ' + formatDuration(gap) + ' · 下一节 ' + minToText(next.start) + ' 开始' + soonText;
    } else {
      state.textContent = '下一节 ' + minToText(next.start) + ' 开始 · 还有 ' + formatDuration(gap) + soonText;
    }
  } else {
    state.textContent = '今天没课了 · 下次是 ' + (next.date.getMonth() + 1) + '月' + next.date.getDate() + '日 '
      + WEEK_CN[dayOfWeek(next.date)] + ' ' + minToText(next.start) + '（' + formatDuration(gap) + '后）';
  }
}

function renderNext(now, current, next) {
  const chip = $('gap-chip');
  const name = $('next-name');
  const meta = $('next-meta');
  const note = $('next-note');

  if (!next) {
    chip.hidden = true;
    name.textContent = '本周没有更多课程';
    meta.textContent = '';
    note.textContent = '（没有备注）';
    return;
  }

  const { course, start, end, dayOffset, date } = next;
  const prevEnd = endOfPrevious(now);
  const fromMin = current ? current.end : (dayOffset === 0 && prevEnd !== null ? prevEnd : minutesOfDay(now));
  const gap = Math.max(0, start - fromMin + dayOffset * 1440);

  chip.hidden = false;
  chip.classList.remove('is-tight', 'is-none');
  const spot = current ? '下课后' : (dayOffset === 0 ? '现在起' : '到那天');
  chip.textContent = spot + '可支配 ' + formatDuration(gap);
  if (gap < 20) chip.classList.add('is-tight');

  name.textContent = course.name;
  const mk = makeupOn(date);
  const dateInfo = dayOffset > 0
    ? WEEK_CN[course.day] + ' ' + (date.getMonth() + 1) + '月' + date.getDate() + '日 · '
    : '';
  meta.textContent = dateInfo
    + (mk ? '【' + makeupLabel(mk) + '】' : '')
    + '第 ' + course.period + ' 节 ' + minToText(start) + '–' + minToText(end)
    + ' · ' + (course.room || '—') + ' · ' + (course.teacher || '—')
    + (course.weeks && course.weeks !== 'all' && !mk ? ' · ' + WEEK_LABEL[course.weeks] : '');
  note.textContent = course.note || '（没有备注）';
}

/* ---------------- 7. 总课表 ---------------- */

function buildGrid(host) {
  host.innerHTML = '';
  const periods = data.settings.periods;
  host.style.gridTemplateRows = 'auto repeat(' + periods + ', minmax(62px, auto))';
  const today = currentTime();

  const corner = document.createElement('div');
  corner.className = 'grid-corner';
  corner.textContent = '时间';
  host.appendChild(corner);

  for (let d = 1; d <= 7; d++) {
    const head = document.createElement('div');
    head.className = 'grid-day';
    if (d === dayOfWeek(today)) head.classList.add('is-today');
    head.textContent = WEEK_CN[d];
    host.appendChild(head);
  }

  // 按"星期+节次"索引，方便找上下节
  const at = (d, p) => data.courses.find((c) => c.day === d && c.period === p) || null;
  const sameRun = (a, b) => a && b && a.name === b.name && a.room === b.room && (a.weeks || 'all') === (b.weeks || 'all');

  for (let p = 1; p <= periods; p++) {
    const range = periodRange(p);
    const time = document.createElement('div');
    time.className = 'grid-time';
    const b = document.createElement('b');
    b.textContent = '第 ' + p + ' 节';
    const s = document.createElement('span');
    s.textContent = minToText(range.start) + '–' + minToText(range.end);
    time.appendChild(b);
    time.appendChild(s);
    host.appendChild(time);

    for (let d = 1; d <= 7; d++) {
      const existing = at(d, p);

      // 同一门课连上多节时，合成一个大格子
      if (existing && sameRun(existing, at(d, p - 1))) continue;

      let span = 1;
      if (existing) {
        for (let q = p + 1; q <= periods; q++) {
          if (sameRun(existing, at(d, q))) span++;
          else break;
        }
      }

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell ' + (existing ? 'cell-filled' : 'cell-empty');
      cell.dataset.day = String(d);
      cell.dataset.period = String(p);
      if (span > 1) cell.style.gridRow = 'span ' + span;

      if (existing) {
        cell.style.setProperty('--hue', String(hueOfName(existing.name)));
        const nm = document.createElement('span');
        nm.className = 'cell-name';
        nm.textContent = existing.name;
        cell.appendChild(nm);
        if (existing.room) {
          const rm = document.createElement('span');
          rm.className = 'cell-room';
          rm.textContent = existing.room;
          cell.appendChild(rm);
        }
        if (existing.weeks && existing.weeks !== 'all') {
          const wk = document.createElement('span');
          wk.className = 'cell-week';
          wk.textContent = WEEK_LABEL[existing.weeks];
          cell.appendChild(wk);
        }
        if (existing.note) {
          const dot = document.createElement('span');
          dot.className = 'cell-note-dot';
          dot.title = existing.note;
          cell.appendChild(dot);
        }
        cell.dataset.startPeriod = String(p);
        cell.dataset.endPeriod = String(p + span - 1);
        cell.title = existing.name + '（第 ' + p + (span > 1 ? '–' + (p + span - 1) : '') + ' 节'
          + (existing.weeks && existing.weeks !== 'all' ? ' · ' + WEEK_LABEL[existing.weeks] : '') + '）点击编辑';
      } else {
        cell.textContent = '+';
        cell.title = '第 ' + p + ' 节 · ' + WEEK_CN[d] + '：点击添加课程';
      }

      host.appendChild(cell);
    }
  }

  const todayHead = host.querySelector('.grid-day.is-today');
  if (todayHead) {
    requestAnimationFrame(() => {
      const wrap = host.parentElement;
      if (!wrap) return;
      wrap.scrollLeft = Math.max(0, todayHead.offsetLeft - wrap.clientWidth / 2 + todayHead.offsetWidth / 2);
    });
  }
}

/* ---------------- 8. 日历 ---------------- */

let calMonth = null;          // 当前显示的月份（Date，指向 1 号）
let calSelected = null;       // 选中的日期

function renderCalendar() {
  if (!calMonth) {
    const now = currentTime();
    calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    calSelected = startOfDay(now);
  }
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  $('cal-title').textContent = y + ' 年 ' + (m + 1) + ' 月 · 第 ' + weekNumber(calMonth) + ' 周起';

  const grid = $('cal-grid');
  grid.innerHTML = '';
  ['日', '一', '二', '三', '四', '五', '六'].forEach((d) => {
    const el = document.createElement('div');
    el.className = 'cal-dow';
    el.textContent = d;
    grid.appendChild(el);
  });

  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < first.getDay(); i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell is-blank';
    grid.appendChild(blank);
  }

  const todayKey = dateKey(currentTime());
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const key = dateKey(date);
    const holiday = holidayOf(date);
    const mk = makeupOn(date);
    const list = coursesOn(date);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-cell';
    cell.dataset.date = key;
    if (key === todayKey) cell.classList.add('is-today');
    if (calSelected && dateKey(calSelected) === key) cell.classList.add('is-selected');
    if (holiday && !mk) cell.classList.add('is-holiday');
    if (mk) cell.classList.add('is-makeup');
    if (eventsOn(date).length) cell.classList.add('has-event');

    const num = document.createElement('span');
    num.className = 'cal-num';
    num.textContent = String(d);
    cell.appendChild(num);

    if (eventsOn(date).length) {
      const en = document.createElement('span');
      en.className = 'cal-event-name';
      const first = eventsOn(date)[0];
      en.textContent = '有事：' + (first.title || '') + (eventsOn(date).length > 1 ? ' +' + (eventsOn(date).length - 1) : '');
      cell.appendChild(en);
    }

    if (mk) {
      const mn = document.createElement('span');
      mn.className = 'cal-makeup-name';
      mn.textContent = makeupLabel(mk);
      cell.appendChild(mn);
    } else if (holiday) {
      const hn = document.createElement('span');
      hn.className = 'cal-holiday-name';
      hn.textContent = holiday.name;
      cell.appendChild(hn);
    }

    if (list.length) {
      const dots = document.createElement('span');
      dots.className = 'cal-dots';
      list.slice(0, 4).forEach((c) => {
        const dot = document.createElement('span');
        dot.className = 'cal-dot';
        dot.style.setProperty('--hue', String(hueOfName(c.name)));
        dots.appendChild(dot);
      });
      if (list.length > 4) {
        const more = document.createElement('span');
        more.className = 'cal-more';
        more.textContent = '+' + (list.length - 4);
        dots.appendChild(more);
      }
      cell.appendChild(dots);
    }

    cell.title = key + (mk ? ' · ' + makeupLabel(mk) : (holiday ? ' · ' + holiday.name : ''))
      + (eventsOn(date).length ? ' · 有事：' + eventsOn(date).map((e) => minToText(e.start) + '–' + minToText(e.end) + ' ' + (e.title || '')).join('；') : '')
      + (list.length ? ' · ' + list.length + ' 节课' : ' · 没课');
    grid.appendChild(cell);
  }

  // 图例
  const legend = $('cal-legend');
  legend.innerHTML = '';
  const li1 = document.createElement('span');
  li1.innerHTML = '<span class="cal-dot" style="--hue:210"></span> 有课（点数=课程数，颜色=课程颜色）';
  const li2 = document.createElement('span');
  li2.textContent = '红底 = 节假日（不上课）';
  const li3 = document.createElement('span');
  li3.textContent = '蓝底 = 调休（补课）';
  const li4 = document.createElement('span');
  li4.textContent = '红字 = 临时有事';
  legend.appendChild(li1);
  legend.appendChild(li2);
  legend.appendChild(li3);
  legend.appendChild(li4);

  renderCalDay();
}

function renderCalDay() {
  const box = $('cal-day');
  box.innerHTML = '';
  if (!calSelected) return;
  const date = calSelected;
  const key = dateKey(date);
  const holiday = holidayOf(date);
  const mk = makeupOn(date);

  const h3 = document.createElement('h3');
  h3.textContent = (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日 · 周' + DOW_CN[date.getDay()];
  box.appendChild(h3);

  const sub = document.createElement('p');
  sub.className = 'cal-day-sub' + (holiday && !mk ? ' is-holiday' : '') + (mk ? ' is-makeup' : '');
  sub.textContent = (mk ? '📚 调休：' + makeupLabel(mk) + '（不上当天的常规课）' : (holiday ? '🎉 ' + holiday.name + '（不上课）' : ''))
    + ' · 第 ' + weekNumber(date) + ' 周 · ' + (weekKind(date) === 'odd' ? '单周' : '双周');
  box.appendChild(sub);

  const list = coursesOn(date);
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'cal-empty';
    p.textContent = mk
      ? '这天是调休，但还没安排任何课。'
      : (holiday ? '节假日，好好休息。' : '这天没有课。');
    box.appendChild(p);
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'cal-list';
    list.forEach((c) => {
      const range = periodRange(c.period);
      const item = document.createElement('div');
      item.className = 'cal-item';
      item.style.setProperty('--hue', String(hueOfName(c.name)));
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = minToText(range.start);
      const body = document.createElement('span');
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = c.name;
      const r = document.createElement('span');
      r.className = 'r';
      r.textContent = (c.room || '—') + ' · ' + (c.teacher || '—');
      body.appendChild(n);
      body.appendChild(document.createElement('br'));
      body.appendChild(r);
      if (c.weeks && c.weeks !== 'all') {
        const w = document.createElement('span');
        w.className = 'w';
        w.textContent = ' ' + WEEK_LABEL[c.weeks];
        body.appendChild(w);
      }
      item.appendChild(t);
      item.appendChild(body);
      wrap.appendChild(item);
    });
    box.appendChild(wrap);
  }

  const actions = document.createElement('div');
  actions.style.marginTop = '10px';
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.flexWrap = 'wrap';

  const mkBtn = document.createElement('button');
  mkBtn.className = 'btn btn-ghost2';
  mkBtn.type = 'button';
  mkBtn.textContent = mk ? '改这天的调休' : '给这天加调休（补课）';
  mkBtn.addEventListener('click', () => MKChoice.open(key, mk));
  actions.appendChild(mkBtn);

  if (holiday) {
    const del = document.createElement('button');
    del.className = 'btn btn-danger';
    del.type = 'button';
    del.textContent = '取消节假日';
    del.addEventListener('click', () => {
      removeHoliday(key);
      renderCalendar();
      tick();
      flashHint('已取消 ' + key + ' 的节假日标记');
    });
    actions.appendChild(del);
  } else {
    const add = document.createElement('button');
    add.className = 'btn btn-ghost2';
    add.type = 'button';
    add.textContent = '标为节假日';
    add.addEventListener('click', () => {
      addHoliday(key, '节假日');
      renderCalendar();
      tick();
      flashHint('已把 ' + key + ' 标为节假日');
    });
    actions.appendChild(add);
  }
  box.appendChild(actions);
}

/* ---------------- 9. 编辑课程 ---------------- */

const SWATCH_HUES = [210, 190, 160, 140, 45, 25, 320, 275, 240, 110, 350, 65];
let edHue = 210;

function renderSwatches() {
  const box = $('ed-swatches');
  box.innerHTML = '';
  SWATCH_HUES.forEach((h) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (Math.abs(h - edHue) < 8 ? ' is-active' : '');
    b.style.setProperty('--hue', String(h));
    b.title = '色相 ' + h;
    b.addEventListener('click', () => setEdHue(h));
    box.appendChild(b);
  });
}

function setEdHue(h) {
  edHue = ((h % 360) + 360) % 360;
  $('ed-hue').value = String(edHue);
  $('ed-hue-text').textContent = String(edHue);
  $('ed-preview').style.setProperty('--hue', String(edHue));
  renderSwatches();
}

const Editor = {
  queued: null,

  fillSelects() {
    const day = $('ed-day');
    const start = $('ed-start');
    const end = $('ed-end');
    if (day.options.length) return;
    for (let d = 1; d <= 7; d++) day.appendChild(new Option(WEEK_CN[d], String(d)));
    start.appendChild(new Option('—', ''));
    end.appendChild(new Option('—', ''));
  },

  // 每天都能选 1..20 节，不受"今天有几节"限制（改作息时不会丢课）
  fillPeriodOptions() {
    const start = $('ed-start');
    const end = $('ed-end');
    const keepStart = start.value;
    const keepEnd = end.value;
    start.innerHTML = '';
    end.innerHTML = '';
    for (let p = 1; p <= 20; p++) {
      const label = '第 ' + p + ' 节' + (p <= data.settings.periods ? '（' + minToText(periodRange(p).start) + '）' : '（超出作息）');
      start.appendChild(new Option(label, String(p)));
      end.appendChild(new Option(label, String(p)));
    }
    if (keepStart) start.value = keepStart;
    if (keepEnd) end.value = keepEnd;
  },

  syncTime() {
    const a = Number($('ed-start').value);
    const b = Number($('ed-end').value);
    const el = $('ed-time');
    if (!a || !b) { el.textContent = '—'; return; }
    if (b < a) { el.textContent = '结束节次早于开始节次'; return; }
    const ra = periodRange(a);
    const rb = periodRange(b);
    el.textContent = '第 ' + a + '–' + b + ' 节 · ' + minToText(ra.start) + '–' + minToText(rb.end);
  },

  open(day, period, course, range) {
    this.queued = {
      mode: 'week',
      day,
      period,
      course,
      oldStart: range ? range.start : period,
      oldEnd: range ? range.end : period
    };
    this.fillSelects();
    this.fillPeriodOptions();

    $('ed-title').textContent = course ? '编辑课程' : '添加课程';
    $('ed-day').value = String(day);
    $('ed-start').value = String(period);
    $('ed-end').value = String(range ? range.end : period);
    $('ed-name').value = course ? course.name : '';
    $('ed-teacher').value = course ? (course.teacher || '') : '';
    $('ed-room').value = course ? (course.room || '') : '';
    $('ed-weeks').value = course ? (course.weeks || 'all') : 'all';
    $('ed-note').value = course ? (course.note || '') : '';
    setEdHue(course ? hueOf(course) : hueFromName($('ed-name').value || '新课程'));
    this.syncTime();

    $('ed-err').hidden = true;
    $('ed-delete').hidden = !course;
    $('editor').hidden = false;
    setTimeout(() => $('ed-name').focus(), 30);
  },

  // 调休的"临时课表"：直接往那一天的临时课表里加课
  openSpecial(key) {
    this.queued = { mode: 'special', key, period: null, course: null };
    this.fillSelects();
    this.fillPeriodOptions();

    $('ed-title').textContent = '临时课表 · ' + key.slice(5) + '（这一天只上你在这里加的课）';
    $('ed-day').value = '1';
    $('ed-start').value = '1';
    $('ed-end').value = '2';
    $('ed-name').value = '';
    $('ed-teacher').value = '';
    $('ed-room').value = '';
    $('ed-weeks').value = 'all';
    $('ed-note').value = '';
    setEdHue(hueFromName('临时'));
    this.syncTime();

    $('ed-err').hidden = true;
    $('ed-delete').hidden = true;
    $('editor').hidden = false;
    setTimeout(() => $('ed-name').focus(), 30);
  },

  close() { $('editor').hidden = true; this.queued = null; },

  save() {
    const q = this.queued;
    if (!q) return;
    const a = Number($('ed-start').value);
    const b = Number($('ed-end').value);
    const name = $('ed-name').value.trim();
    const teacher = $('ed-teacher').value.trim();
    const room = $('ed-room').value.trim();
    const note = $('ed-note').value.trim();
    const err = $('ed-err');

    if (!name) { err.textContent = '课程名称不能空着'; err.hidden = false; return; }
    if (!a || !b || b < a) { err.textContent = '节次范围不对：结束节次不能早于开始节次'; err.hidden = false; return; }

    const weeks = $('ed-weeks').value;

    // 情况一：往调休那天的临时课表里加课
    if (q.mode === 'special') {
      const mk = stDraft.makeups.find((m) => m.date === q.key);
      if (!mk) { err.textContent = '找不到这天的调休记录'; err.hidden = false; return; }
      mk.courses = (mk.courses || []).filter((c) => c.period < a || c.period > b);
      for (let p = a; p <= b; p++) {
        mk.courses.push({ day: dayOfWeek(parseDateKey(q.key)), period: p, name, teacher, room, note, weeks: 'all', hue: edHue });
      }
      mk.courses.sort((x, y) => x.period - y.period);
      Settings.renderHolidays();
      Settings.renderMiniCal();
      this.close();
      flashHint('已加到 ' + q.key.slice(5) + ' 的临时课表（记得回设置面板点保存）');
      return;
    }

    // 情况二：常规周课表
    const day = Number($('ed-day').value);
    if (q.course) {
      data.courses = data.courses.filter((c) => !(c.day === q.day && c.period >= q.oldStart && c.period <= q.oldEnd));
    }
    data.courses = data.courses.filter((c) => !(c.day === day && c.period >= a && c.period <= b));

    for (let p = a; p <= b; p++) {
      data.courses.push({ day, period: p, name, teacher, room, note, weeks, hue: edHue });
    }
    data.courses.sort((x, y) => (x.day - y.day) || (x.period - y.period));
    refreshHueMap();

    saveData();
    refreshPanels();
    tick();
    this.close();
    flashHint('已保存：' + WEEK_CN[day] + ' 第 ' + a + (b > a ? '–' + b : '') + ' 节 · ' + name
      + (weeks !== 'all' ? ' · ' + WEEK_LABEL[weeks] : ''));
  },

  remove() {
    const q = this.queued;
    if (!q || !q.course) return;
    const { day, name, room } = q.course;
    data.courses = data.courses.filter((c) => !(c.day === day && c.name === name && c.room === room));
    refreshHueMap();
    saveData();
    refreshPanels();
    tick();
    this.close();
    flashHint('已删除：' + WEEK_CN[day] + ' ' + name);
  }
};

/* ---------------- 10. 作息设置 / 节假日 / 调休 ---------------- */

let stDraft = null;

function newDraft() {
  const s = data.settings;
  const times = [];
  for (let p = 1; p <= s.periods; p++) {
    const r = periodRange(p);
    times.push({ start: r.start, end: r.end });
  }
  return {
    periods: s.periods,
    periodTimes: times,
    termStart: s.termStart,
    holidays: data.holidays.map((h) => ({ date: h.date, name: h.name })),
    makeups: JSON.parse(JSON.stringify(data.makeups || [])),
    holiMonth: null
  };
}

// 按节数补齐/裁掉时间表
function draftTimes() {
  while (stDraft.periodTimes.length < stDraft.periods) {
    const last = stDraft.periodTimes[stDraft.periodTimes.length - 1];
    const start = last ? last.end + 5 : 8 * 60;
    stDraft.periodTimes.push({ start, end: start + 45 });
  }
  stDraft.periodTimes.length = stDraft.periods;
  return stDraft.periodTimes;
}

function draftRange(p) {
  const t = draftTimes()[p - 1];
  return { start: t.start, end: t.end };
}

const Settings = {
  open() {
    stDraft = newDraft();
    stDraft.holiMonth = new Date(currentTime().getFullYear(), currentTime().getMonth(), 1);

    const sel = $('st-periods');
    sel.innerHTML = '';
    for (let p = 4; p <= 20; p++) sel.appendChild(new Option(p + ' 节', String(p)));
    sel.value = String(stDraft.periods);
    $('st-term').value = stDraft.termStart || '';
    $('st-batch').hidden = true;

    this.renderClock();
    this.renderHolidays();
    this.renderMiniCal();
    $('st-err').hidden = true;
    $('settings').hidden = false;
  },

  // 每节课一行：自己填开始和结束时间，行下面标出和上一节之间空多少分钟
  renderClock() {
    const box = $('st-clock');
    box.innerHTML = '';
    const times = draftTimes();
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const prev = i > 0 ? times[i - 1] : null;

      const gap = document.createElement('div');
      gap.className = 'gap-line';
      gap.textContent = prev
        ? '↓ 空 ' + Math.max(0, t.start - prev.end) + ' 分钟'
        : '　';
      box.appendChild(gap);

      const row = document.createElement('div');
      row.className = 'clock-row';

      const label = document.createElement('b');
      label.textContent = '第 ' + (i + 1) + ' 节';
      row.appendChild(label);

      const startInput = document.createElement('input');
      startInput.type = 'time';
      startInput.value = minToText(t.start);
      startInput.addEventListener('change', () => {
        const v = textToMin(startInput.value);
        if (v === null) { startInput.value = minToText(stDraft.periodTimes[i].start); return; }
        const len = Math.max(1, stDraft.periodTimes[i].end - stDraft.periodTimes[i].start);
        stDraft.periodTimes[i].start = v;
        stDraft.periodTimes[i].end = v + len;   // 保持这一节时长不变
        this.renderClock();
      });
      row.appendChild(startInput);

      const sep = document.createElement('span');
      sep.className = 'dash';
      sep.textContent = '–';
      row.appendChild(sep);

      const endInput = document.createElement('input');
      endInput.type = 'time';
      endInput.value = minToText(t.end);
      endInput.addEventListener('change', () => {
        const v = textToMin(endInput.value);
        if (v === null) { endInput.value = minToText(stDraft.periodTimes[i].end); return; }
        if (v <= stDraft.periodTimes[i].start) { endInput.value = minToText(stDraft.periodTimes[i].end); return; }
        stDraft.periodTimes[i].end = v;
        this.renderClock();
      });
      row.appendChild(endInput);

      const mins = document.createElement('span');
      mins.className = 'mins';
      mins.textContent = (t.end - t.start) + ' 分钟';
      row.appendChild(mins);

      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'mini-btn';
      reset.textContent = '重置';
      reset.title = '按第 1 节的规律重新排这一节';
      reset.addEventListener('click', () => {
        const first = stDraft.periodTimes[0];
        const len = first.end - first.start;
        const prev2 = i > 0 ? stDraft.periodTimes[i - 1] : null;
        const start = prev2 ? prev2.end + 5 : first.start;
        stDraft.periodTimes[i] = { start, end: start + len };
        this.renderClock();
      });
      row.appendChild(reset);

      box.appendChild(row);
    }
  },

  // 批量设置：第 1 节开始 + 每节多少分钟 + 课间多少分钟 → 重排整张表
  applyBatch() {
    const start = textToMin($('st-batch-start').value);
    const len = Math.max(10, Number($('st-batch-len').value) || 45);
    const gap = Math.max(0, Number($('st-batch-gap').value) || 0);
    if (start === null) return;
    stDraft.periodTimes = [];
    let cursor = start;
    for (let p = 1; p <= stDraft.periods; p++) {
      stDraft.periodTimes.push({ start: cursor, end: cursor + len });
      cursor += len + gap;
    }
    this.renderClock();
    flashHint('已按批量规则重排 ' + stDraft.periods + ' 节课的时间（记得点保存）');
  },

  renderHolidays() {
    const hBox = $('st-holiday-list');
    hBox.innerHTML = '';
    if (!stDraft.holidays.length) {
      const p = document.createElement('span');
      p.className = 'holiday-empty';
      p.textContent = '还没有节假日。点上面的日期就能加。';
      hBox.appendChild(p);
    } else {
      stDraft.holidays.forEach((h) => {
        const chip = document.createElement('span');
        chip.className = 'holiday-chip';
        chip.textContent = h.date.slice(5) + ' ' + h.name;
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '×';
        del.title = '删除这个节假日';
        del.addEventListener('click', () => {
          stDraft.holidays = stDraft.holidays.filter((x) => x.date !== h.date);
          this.renderHolidays();
          this.renderMiniCal();
        });
        chip.appendChild(del);
        hBox.appendChild(chip);
      });
    }

    const mBox = $('st-makeup-list');
    mBox.innerHTML = '';
    if (!stDraft.makeups.length) {
      const p = document.createElement('span');
      p.className = 'holiday-empty';
      p.textContent = '还没有调休。右键（手机上长按）某一天可以加。';
      mBox.appendChild(p);
    } else {
      stDraft.makeups.forEach((m) => {
        const chip = document.createElement('span');
        chip.className = 'holiday-chip is-makeup';
        chip.textContent = m.date.slice(5) + ' ' + makeupLabel(m);
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '×';
        del.title = '取消这天的调休';
        del.addEventListener('click', () => {
          stDraft.makeups = stDraft.makeups.filter((x) => x.date !== m.date);
          this.renderHolidays();
          this.renderMiniCal();
        });
        chip.appendChild(del);
        mBox.appendChild(chip);
      });
    }
  },

  // 设置面板里的小日历：点=节假日，右键/长按=调休
  renderMiniCal() {
    const y = stDraft.holiMonth.getFullYear();
    const m = stDraft.holiMonth.getMonth();
    $('hm-title').textContent = y + ' 年 ' + (m + 1) + ' 月';

    const grid = $('hm-grid');
    grid.innerHTML = '';
    ['日', '一', '二', '三', '四', '五', '六'].forEach((d) => {
      const el = document.createElement('div');
      el.className = 'mini-dow';
      el.textContent = d;
      grid.appendChild(el);
    });

    const first = new Date(y, m, 1);
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < first.getDay(); i++) {
      const blank = document.createElement('div');
      blank.className = 'mini-cell is-blank';
      grid.appendChild(blank);
    }
    const todayKey = dateKey(currentTime());
    for (let d = 1; d <= days; d++) {
      const key = y + '-' + pad2(m + 1) + '-' + pad2(d);
      const holi = stDraft.holidays.find((h) => h.date === key);
      const mk = stDraft.makeups.find((x) => x.date === key);

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'mini-cell';
      if (holi) cell.classList.add('is-holiday');
      if (mk) cell.classList.add('is-makeup');
      if (key === todayKey) cell.classList.add('is-today');

      const num = document.createElement('span');
      num.textContent = String(d);
      cell.appendChild(num);
      if (holi || mk) {
        const mark = document.createElement('span');
        mark.className = 'mini-mark';
        mark.textContent = mk ? '调休' : '假';
        cell.appendChild(mark);
      }
      cell.title = key + (holi ? ' · ' + holi.name : '') + (mk ? ' · ' + makeupLabel(mk) : '')
        + '（点=节假日，右键/长按=调休）';

      cell.addEventListener('click', () => {
        stDraft.makeups = stDraft.makeups.filter((x) => x.date !== key);
        if (holi) {
          stDraft.holidays = stDraft.holidays.filter((h) => h.date !== key);
        } else {
          stDraft.holidays.push({ date: key, name: '节假日' });
        }
        this.renderHolidays();
        this.renderMiniCal();
      });

      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.askMakeup(key);
      });

      let timer = null;
      cell.addEventListener('touchstart', () => {
        timer = setTimeout(() => { timer = null; this.askMakeup(key); }, 550);
      }, { passive: true });
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
      cell.addEventListener('touchend', cancel);
      cell.addEventListener('touchmove', cancel);

      grid.appendChild(cell);
    }
  },

  // 右键/长按后：问用户用哪种方式补课
  askMakeup(key) {
    const existing = stDraft.makeups.find((m) => m.date === key) || null;
    MKChoice.open(key, existing);
  },

  save() {
    const err = $('st-err');
    const periods = stDraft.periods;

    // 检查有没有课会掉到新作息之外
    const outOfRange = data.courses.filter((c) => c.period > periods);
    if (outOfRange.length) {
      const names = [...new Set(outOfRange.map((c) => WEEK_CN[c.day] + ' 第' + c.period + '节 ' + c.name))].slice(0, 3);
      err.textContent = '有 ' + outOfRange.length + ' 节课落在新的节数之外（' + names.join('；')
        + '…）。请先把节数调大，或删掉这些课。';
      err.hidden = false;
      return;
    }

    data.settings = {
      periods,
      periodTimes: draftTimes().map((t) => ({ start: t.start, end: t.end })),
      termStart: stDraft.termStart || data.settings.termStart
    };
    // 顺手把老的三个字段也更新一下，方便以后导出/排查
    const first = data.settings.periodTimes[0];
    const second = data.settings.periodTimes[1];
    data.settings.startMin = first ? first.start : 8 * 60;
    data.settings.periodMin = first ? first.end - first.start : 45;
    data.settings.breaks = [];
    for (let i = 1; i < data.settings.periodTimes.length; i++) {
      data.settings.breaks.push(Math.max(0, data.settings.periodTimes[i].start - data.settings.periodTimes[i - 1].end));
    }
    data.holidays = stDraft.holidays.slice().sort((a, b) => a.date.localeCompare(b.date));
    data.makeups = stDraft.makeups.slice().sort((a, b) => a.date.localeCompare(b.date));

    saveData();
    refreshPanels();
    tick();
    $('settings').hidden = true;
    flashHint('已保存：一天 ' + periods + ' 节 · 第 1 节 '
      + minToText(data.settings.periodTimes[0].start) + '–'
      + minToText(data.settings.periodTimes[periods - 1].end)
      + ' · 节假日 ' + data.holidays.length + ' 天 · 调休 ' + data.makeups.length + ' 天');
  }
};

/* ---------------- 10c. 临时事件（有事） ---------------- */

let evDate = null;

const EventPanel = {
  open(key, id) {
    const now = currentTime();
    evDate = key || dateKey(now);
    const ev = id ? eventById(id) : null;

    const sel = $('ev-date');
    sel.value = evDate;
    $('ev-title-input').value = ev ? ev.title : '';
    $('ev-note-input').value = ev ? (ev.note || '') : '';
    $('ev-start').value = ev ? minToText(ev.start) : minToText(Math.max(0, minutesOfDay(now)));
    $('ev-end').value = ev ? minToText(ev.end) : minToText(Math.min(23 * 60 + 59, minutesOfDay(now) + 60));
    $('ev-title-text').textContent = ev ? '改这个临时事件' : '添加临时事件';
    $('ev-delete').hidden = !ev;
    this.draft = { id: ev ? ev.id : null };
    this.check();
    $('event-panel').hidden = false;
    setTimeout(() => $('ev-title-input').focus(), 30);
  },

  close() { $('event-panel').hidden = true; this.draft = null; },

  read() {
    const key = $('ev-date').value;
    const start = textToMin($('ev-start').value);
    const end = textToMin($('ev-end').value);
    return { key, start, end, title: $('ev-title-input').value.trim(), note: $('ev-note-input').value.trim() };
  },

  // 实时显示冲突：红框=有课冲突，绿框=无冲突
  check() {
    const d = this.read();
    const box = $('ev-conflict');
    box.innerHTML = '';
    if (!parseDateKey(d.key) || d.start === null || d.end === null || d.end <= d.start) {
      box.className = 'conflict-box is-warn';
      box.textContent = '请先选好日期和起止时间（结束要晚于开始）';
      return;
    }
    const list = conflictsFor(d.key, d.start, d.end);
    box.className = 'conflict-box ' + (list.length ? 'is-bad' : 'is-good');
    const head = document.createElement('b');
    head.textContent = list.length ? '⚠ 与 ' + list.length + ' 节课冲突' : '✓ 无冲突';
    box.appendChild(head);
    list.forEach((c) => {
      const line = document.createElement('div');
      line.className = 'conflict-line';
      line.innerHTML = '<span class="conflict-name">' + c.course.name + '</span>'
        + ' 第 ' + c.course.period + ' 节 ' + minToText(c.range.start) + '–' + minToText(c.range.end)
        + (c.course.room ? ' · ' + c.course.room : '')
        + (c.course.weeks && c.course.weeks !== 'all' ? ' · ' + WEEK_LABEL[c.course.weeks] : '');
      box.appendChild(line);
    });
    if (list.length) {
      const tip = document.createElement('div');
      tip.className = 'conflict-tip';
      tip.textContent = '这些课在这段时间里会在左上大框里以"冲突"显示。';
      box.appendChild(tip);
    }
  },

  save() {
    const d = this.read();
    const err = $('ev-err');
    if (!parseDateKey(d.key)) { err.textContent = '先选日期'; err.hidden = false; return; }
    if (d.start === null || d.end === null || d.end <= d.start) {
      err.textContent = '时间段不对：结束时间要晚于开始时间';
      err.hidden = false;
      return;
    }
    if (!d.title) { err.textContent = '给这件事起个名字吧（比如"去医院"）'; err.hidden = false; return; }

    if (this.draft && this.draft.id) {
      data.events = data.events.filter((e) => e.id !== this.draft.id);
    }
    data.events.push({
      id: 'e' + Date.now().toString(36),
      date: d.key, start: d.start, end: d.end, title: d.title, note: d.note
    });
    data.events.sort((a, b) => (a.date + a.start) .localeCompare(b.date + b.start));
    saveData();
    refreshPanels();
    tick();
    this.close();
    flashHint('已添加有事：' + d.key.slice(5) + ' ' + minToText(d.start) + '–' + minToText(d.end) + ' · ' + d.title);
  },

  remove() {
    if (!this.draft || !this.draft.id) return;
    data.events = data.events.filter((e) => e.id !== this.draft.id);
    saveData();
    refreshPanels();
    tick();
    this.close();
    flashHint('已删除这个临时事件');
  }
};

// 今天有什么"有事"，给看板用
function todayEvents(date) { return eventsOn(date); }

/* ---------------- 10d. 调休的两个小面板 ---------------- */

let mkDate = null;

const MKChoice = {
  open(key, existing) {
    mkDate = key;
    const d = parseDateKey(key);
    $('mk-choice-title').textContent = '这一天怎么安排？';
    $('mk-choice-sub').textContent = d
      ? (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 周' + DOW_CN[d.getDay()]
        + '（第 ' + weekNumber(d) + ' 周 · ' + (weekKind(d) === 'odd' ? '单周' : '双周') + '）'
        + (existing ? ' · 已有调休：' + makeupLabel(existing) : '')
      : key;
    $('mk-choice-remove').hidden = !existing;
    $('mk-choice').hidden = false;
  },
  close() { $('mk-choice').hidden = true; }
};

const MKRec = {
  open(key) {
    mkDate = key;
    const d = parseDateKey(key);
    const sel = $('mkr-weekday');
    sel.innerHTML = '';
    for (let i = 1; i <= 7; i++) sel.appendChild(new Option(WEEK_CN[i], String(i)));
    sel.value = String(dayOfWeek(d) === 6 || dayOfWeek(d) === 7 ? 1 : dayOfWeek(d));
    $('mkr-week').value = String(weekNumber(d));
    $('mkr-date').textContent = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 周' + DOW_CN[d.getDay()]
      + '（这天本身是第 ' + weekNumber(d) + ' 周 · ' + (weekKind(d) === 'odd' ? '单周' : '双周') + '）';
    $('mkr-err').hidden = true;
    this.preview();
    $('mk-rec').hidden = false;
  },

  // 预览：按选中的星期和参照周，会排出哪些课
  preview() {
    const weekday = Number($('mkr-weekday').value);
    const week = Math.max(1, Number($('mkr-week').value) || 1);
    const ref = referenceDateFor(week, weekday);
    const list = data.courses
      .filter((c) => c.day === weekday && courseMatchesWeek(c, ref))
      .sort((a, b) => a.period - b.period);
    const box = $('mkr-preview');
    box.innerHTML = '';
    if (!list.length) {
      const p = document.createElement('div');
      p.textContent = '这一天没有课';
      box.appendChild(p);
      return;
    }
    list.forEach((c) => {
      const r = periodRange(c.period);
      const el = document.createElement('div');
      el.innerHTML = '<b>' + minToText(r.start) + '</b> ' + c.name
        + (c.room ? ' · ' + c.room : '')
        + (c.weeks && c.weeks !== 'all' ? ' · ' + WEEK_LABEL[c.weeks] : '');
      box.appendChild(el);
    });
  },

  save() {
    const weekday = Number($('mkr-weekday').value);
    const week = Math.max(1, Number($('mkr-week').value) || 1);
    const err = $('mkr-err');
    const list = data.courses.filter((c) => c.day === weekday && courseMatchesWeek(c, referenceDateFor(week, weekday)));
    if (!list.length) {
      err.textContent = '这个组合下没有课，先选别的星期或周次吧';
      err.hidden = false;
      return;
    }
    stDraft.holidays = stDraft.holidays.filter((h) => h.date !== mkDate);
    stDraft.makeups = stDraft.makeups.filter((m) => m.date !== mkDate);
    stDraft.makeups.push({ date: mkDate, mode: 'recurring', weekday, week });
    Settings.renderHolidays();
    Settings.renderMiniCal();
    $('mk-rec').hidden = true;
    flashHint('已添加调休：' + mkDate.slice(5) + ' ' + makeupLabel({ mode: 'recurring', weekday, week })
      + '（记得回设置面板点保存）');
  }
};

// 第 week 周的星期 weekday 对应的具体日期
function referenceDateFor(week, weekday) {
  const term = parseDateKey(data.settings.termStart) || new Date();
  const termMonday = startOfDay(term);
  const d = new Date(termMonday.getFullYear(), termMonday.getMonth(), termMonday.getDate() + (week - 1) * 7 + (weekday - 1));
  return d;
}

// 在日历里直接加/改某天的调休（草稿不存在就现开一个）
function addMakeupOn(key) {
  if (!stDraft) stDraft = newDraft();
  const existing = stDraft.makeups.find((m) => m.date === key) || null;
  MKChoice.open(key, existing);
}

/* ---------------- 11. 交互 ---------------- */

let flashTimer = null;
function flashHint(text) {
  const box = $('save-hint');
  box.hidden = false;
  box.textContent = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    box.hidden = true;
    renderSaveHint();
  }, 2800);
}

function refreshPanels() {
  if (!$('table-panel').hidden) buildGrid($('grid'));
  if (!$('cal-panel').hidden) renderCalendar();
}

function setEditMode(on) {
  editMode = on;
  document.body.classList.toggle('editing', on);
  const btn = $('btn-edit');
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? '编辑中（点课表改课）' : '编辑课程';
  $('table-tip').textContent = on
    ? '点任意格子：有课的改课、空格的加课'
    : '开启「编辑课程」后，点格子即可修改';
}

function openTablePanel() {
  const panel = $('table-panel');
  if (!panel.hidden) return;
  buildGrid($('grid'));
  panel.hidden = false;
  $('btn-table').setAttribute('aria-expanded', 'true');
  $('btn-table').textContent = '收起课表';
}

function toggleTablePanel() {
  const panel = $('table-panel');
  if (panel.hidden) {
    openTablePanel();
  } else {
    panel.hidden = true;
    $('btn-table').setAttribute('aria-expanded', 'false');
    $('btn-table').textContent = '全部课程';
  }
}

function openCalPanel() {
  const panel = $('cal-panel');
  if (!panel.hidden) return;
  renderCalendar();
  panel.hidden = false;
  $('btn-cal').setAttribute('aria-expanded', 'true');
  $('btn-cal').textContent = '收起日历';
}

function init() {
  renderSaveHint();
  Editor.fillSelects();

  $('btn-table').addEventListener('click', toggleTablePanel);

  $('btn-cal').addEventListener('click', () => {
    const panel = $('cal-panel');
    if (panel.hidden) {
      openCalPanel();
    } else {
      panel.hidden = true;
      $('btn-cal').setAttribute('aria-expanded', 'false');
      $('btn-cal').textContent = '日历';
    }
  });

  // 点「编辑课程」：自动把课表打开（本来就开着就不动）
  $('btn-edit').addEventListener('click', () => {
    const turningOn = !editMode;
    setEditMode(turningOn);
    if (turningOn) openTablePanel();
  });

  $('btn-settings').addEventListener('click', () => Settings.open());

  $('grid').addEventListener('click', (e) => {
    if (!editMode) return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const day = Number(cell.dataset.day);
    const period = Number(cell.dataset.period);
    const course = data.courses.find((c) => c.day === day && c.period === period) || null;
    const range = course
      ? { start: Number(cell.dataset.startPeriod), end: Number(cell.dataset.endPeriod) }
      : null;
    Editor.open(day, period, course, range);
  });

  // 日历：选日期 / 翻月 / 右键加调休
  $('cal-grid').addEventListener('click', (e) => {
    const cell = e.target.closest('.cal-cell');
    if (!cell || !cell.dataset.date) return;
    const d = parseDateKey(cell.dataset.date);
    if (d) {
      calSelected = d;
      renderCalendar();
    }
  });
  $('cal-grid').addEventListener('contextmenu', (e) => {
    const cell = e.target.closest('.cal-cell');
    if (!cell || !cell.dataset.date) return;
    e.preventDefault();
    addMakeupOn(cell.dataset.date);
  });
  $('cal-prev').addEventListener('click', () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  $('cal-next').addEventListener('click', () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  $('cal-today').addEventListener('click', () => {
    const now = currentTime();
    calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    calSelected = startOfDay(now);
    renderCalendar();
  });

  // 编辑面板
  $('ed-hue').addEventListener('input', (e) => setEdHue(Number(e.target.value)));
  $('ed-start').addEventListener('change', () => Editor.syncTime());
  $('ed-end').addEventListener('change', () => Editor.syncTime());
  $('ed-save').addEventListener('click', () => Editor.save());
  $('ed-delete').addEventListener('click', () => Editor.remove());
  $('ed-close').addEventListener('click', () => Editor.close());
  $('ed-cancel').addEventListener('click', () => Editor.close());
  $('editor').addEventListener('click', (e) => { if (e.target === $('editor')) Editor.close(); });

  // 作息面板：节数 / 学期第一周 / 批量设置 / 小日历
  $('st-periods').addEventListener('change', () => {
    stDraft.periods = Number($('st-periods').value) || 12;
    Settings.renderClock();
  });
  $('st-term').addEventListener('change', () => {
    const d = parseDateKey($('st-term').value);
    if (d) stDraft.termStart = $('st-term').value;
  });
  $('st-batch-toggle').addEventListener('click', () => {
    const box = $('st-batch');
    box.hidden = !box.hidden;
    if (!box.hidden && stDraft.periodTimes[0]) {
      $('st-batch-start').value = minToText(stDraft.periodTimes[0].start);
      $('st-batch-len').value = String(stDraft.periodTimes[0].end - stDraft.periodTimes[0].start);
      const second = stDraft.periodTimes[1];
      $('st-batch-gap').value = String(second ? Math.max(0, second.start - stDraft.periodTimes[0].end) : 5);
    }
  });
  $('st-batch-apply').addEventListener('click', () => Settings.applyBatch());

  $('hm-prev').addEventListener('click', () => {
    stDraft.holiMonth = new Date(stDraft.holiMonth.getFullYear(), stDraft.holiMonth.getMonth() - 1, 1);
    Settings.renderMiniCal();
  });
  $('hm-next').addEventListener('click', () => {
    stDraft.holiMonth = new Date(stDraft.holiMonth.getFullYear(), stDraft.holiMonth.getMonth() + 1, 1);
    Settings.renderMiniCal();
  });

  $('st-save').addEventListener('click', () => Settings.save());
  $('st-close').addEventListener('click', () => { $('settings').hidden = true; });
  $('st-cancel').addEventListener('click', () => { $('settings').hidden = true; });
  $('settings').addEventListener('click', (e) => { if (e.target === $('settings')) $('settings').hidden = true; });

  // 临时有事
  $('btn-event').addEventListener('click', () => {
    const now = currentTime();
    EventPanel.open(dateKey(now), null);
  });
  ['ev-date', 'ev-start', 'ev-end'].forEach((id) => {
    $(id).addEventListener('change', () => EventPanel.check());
    $(id).addEventListener('input', () => EventPanel.check());
  });
  $('ev-save').addEventListener('click', () => EventPanel.save());
  $('ev-delete').addEventListener('click', () => EventPanel.remove());
  $('ev-close').addEventListener('click', () => EventPanel.close());
  $('ev-cancel').addEventListener('click', () => EventPanel.close());
  $('event-panel').addEventListener('click', (e) => { if (e.target === $('event-panel')) EventPanel.close(); });

  // 调休：选择方式
  $('mk-choice-recurring').addEventListener('click', () => {
    $('mk-choice').hidden = true;
    MKRec.open(mkDate);
  });
  $('mk-choice-special').addEventListener('click', () => {
    $('mk-choice').hidden = true;
    stDraft.holidays = stDraft.holidays.filter((h) => h.date !== mkDate);
    stDraft.makeups = stDraft.makeups.filter((m) => m.date !== mkDate);
    stDraft.makeups.push({ date: mkDate, mode: 'special', courses: [] });
    Settings.renderHolidays();
    Settings.renderMiniCal();
    Editor.openSpecial(mkDate);
  });
  $('mk-choice-remove').addEventListener('click', () => {
    stDraft.makeups = stDraft.makeups.filter((m) => m.date !== mkDate);
    stDraft.holidays = stDraft.holidays.filter((h) => h.date !== mkDate);
    Settings.renderHolidays();
    Settings.renderMiniCal();
    MKChoice.close();
  });
  $('mk-choice-cancel').addEventListener('click', () => MKChoice.close());
  $('mk-choice').addEventListener('click', (e) => { if (e.target === $('mk-choice')) MKChoice.close(); });

  // 调休：按周几
  $('mkr-weekday').addEventListener('change', () => MKRec.preview());
  $('mkr-week').addEventListener('input', () => MKRec.preview());
  $('mkr-save').addEventListener('click', () => MKRec.save());
  $('mkr-close').addEventListener('click', () => { $('mk-rec').hidden = true; });
  $('mkr-cancel').addEventListener('click', () => { $('mk-rec').hidden = true; });
  $('mk-rec').addEventListener('click', (e) => { if (e.target === $('mk-rec')) $('mk-rec').hidden = true; });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('editor').hidden) Editor.close();
    else if (!$('event-panel').hidden) EventPanel.close();
    else if (!$('mk-rec').hidden) $('mk-rec').hidden = true;
    else if (!$('mk-choice').hidden) MKChoice.close();
    else if (!$('settings').hidden) $('settings').hidden = true;
  });

  // 调试开关
  if (has('edit')) setEditMode(true);
  if (has('view')) openTablePanel();
  if (has('cal')) openCalPanel();
  const cellSpec = qp('cell');
  if (cellSpec) {
    const [d, p] = cellSpec.split('-').map(Number);
    if (d >= 1 && d <= 7 && p >= 1 && p <= 20) {
      const course = data.courses.find((c) => c.day === d && c.period === p) || null;
      let span = 1;
      if (course) {
        for (let q = p + 1; q <= data.settings.periods; q++) {
          const c = data.courses.find((x) => x.day === d && x.period === q);
          if (c && c.name === course.name && c.room === course.room) span++;
          else break;
        }
      }
      Editor.open(d, p, course, course ? { start: p, end: p + span - 1 } : null);
    }
  }
  if (has('settings')) Settings.open();
  if (has('evopen')) {
    const now = currentTime();
    const todays = eventsOn(now);
    EventPanel.open(dateKey(now), todays.length ? todays[0].id : null);
  }
  // 自测：以某个时间段打开"有事"面板，看冲突提示（#evcheck=09:30-10:20 或 #evcheck=09:36-09:39）
  const evCheck = DIAG ? qp('evcheck') : null;
  if (evCheck) {
    const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(evCheck);
    if (m) {
      EventPanel.open(dateKey(currentTime()), null);
      $('ev-start').value = m[1] + ':' + m[2];
      $('ev-end').value = m[3] + ':' + m[4];
      EventPanel.check();
    }
  }
  // 自测：给某天塞一个临时事件（#event=09:30-10:20 或 #event=09:30-11:00）
  const evSpec = DIAG ? qp('event') : null;
  if (evSpec) {
    const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(evSpec);
    if (m) {
      const key = dateKey(currentTime());
      data.events = (data.events || []).filter((e) => e.date !== key);
      data.events.push({
        id: 'evtest-01',
        date: key,
        start: Number(m[1]) * 60 + Number(m[2]),
        end: Number(m[3]) * 60 + Number(m[4]),
        title: '去医院', note: '带上病历本，挂号在 3 楼'
      });
      saveData();
      boot('已写入测试事件');
    }
  }
  if (DIAG && has('makeup')) {
    // 自测：给 2026-10-08 加一次"照第 5 周周四上课"的调休
    stDraft = newDraft();
    stDraft.makeups = stDraft.makeups.filter((m) => m.date !== '2026-10-08');
    stDraft.makeups.push({ date: '2026-10-08', mode: 'recurring', weekday: 4, week: 5 });
    data.makeups = stDraft.makeups.slice();
    saveData();
    boot('已写入调休测试数据');
  }

  const seedRaw = DIAG ? qp('seed') : null;
  if (seedRaw) {
    try {
      const seed = JSON.parse(seedRaw);
      if (Array.isArray(seed)) {
        data.courses = data.courses.filter((c) => !(c.day === 7 && c.period >= 1 && c.period <= 3));
        seed.forEach((p) => data.courses.push({
          day: 7, period: p, name: '自测课', teacher: '测试', room: 'T101', hue: 210, weeks: 'all', note: '自动测试写入'
        }));
        data.courses.sort((x, y) => (x.day - y.day) || (x.period - y.period));
        saveData();
      }
    } catch (e) {
      boot('seed 写入失败 ' + e.name + ': ' + e.message);
    }
  }
}

/* ---------------- 12. 主循环 ---------------- */

function tick() {
  const now = currentTime();
  const current = findCurrent(now);
  const next = findNext(now);
  $('clock').textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  renderNow(now, current, next);
  renderNext(now, current, next);
}

try {
  refreshHueMap();
  boot('颜色表就绪');
  init();
  boot('init 完成');
  tick();
  boot('tick 完成');
  setInterval(tick, 1000);
  renderDiag();
  setupOffline();
} catch (err) {
  const el = document.getElementById('boot');
  if (el) {
    el.hidden = false;
    el.textContent = '启动崩溃 ' + err.name + ': ' + err.message + ' @ '
      + String(err.stack || '').split('\n').slice(0, 3).join(' | ');
  }
  console.error(err);
}

/* ---------------- 13. 离线可用（PWA） ----------------
   注册 Service Worker，把页面本身缓存下来，这样手机断网也能打开。
   file:// 打开、或者浏览器不支持时，就跳过，页面照常工作。 */
function setupOffline() {
  const link = $('foot-hint');
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    if (DIAG) boot('非 https，跳过离线缓存');
    return;
  }
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(
    () => { if (DIAG) boot('离线缓存已开启'); },
    (e) => { if (DIAG) boot('离线缓存注册失败：' + e.message); }
  );
}
