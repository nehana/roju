// ---------- Daily seeding: everyone gets the same puzzle on the same day ----------
const today = new Date();
const DATE_KEY = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const DAY_NUM = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);

function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function rng(seedStr) {
  let a = hash(seedStr);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Storage ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("roju:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("roju:" + k, JSON.stringify(v)); } catch {} },
};

function bumpStreak() {
  const s = store.get("streak", { count: 0, last: null });
  if (s.last === DATE_KEY) return;
  const y = new Date(today); y.setDate(y.getDate() - 1);
  const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  s.count = s.last === yKey ? s.count + 1 : 1;
  s.last = DATE_KEY;
  store.set("streak", s);
  renderHeader();
}

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

let teluguVoice = null;
function loadVoice() {
  teluguVoice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("te")) || null;
}
if ("speechSynthesis" in window) { loadVoice(); speechSynthesis.onvoiceschanged = loadVoice; }
function speak(text) {
  if (!teluguVoice) return toast("No Telugu voice on this device 😅");
  const u = new SpeechSynthesisUtterance(text);
  u.voice = teluguVoice; u.lang = teluguVoice.lang; u.rate = 0.85;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

async function share(text) {
  if (navigator.share) { try { await navigator.share({ text }); return; } catch {} }
  try { await navigator.clipboard.writeText(text); toast("Copied! Paste it in the family group chat 📲"); }
  catch { prompt("Copy your result:", text); }
}

function renderHeader() {
  $("#date").textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const s = store.get("streak", { count: 0 });
  $("#streak").textContent = `🔥 ${s.count} day streak`;
}

// ---------- 1. Word of the Day ----------
const ALL_WORDS = [...EASY_WORDS, ...HARD_WORDS];
const WORD_ORDER = shuffle(ALL_WORDS, rng("roju-word-order")); // fixed order, cycles daily
const WOTD = WORD_ORDER[DAY_NUM % WORD_ORDER.length];

function renderWord() {
  const w = WOTD;
  $("#view-word").innerHTML = `
    <div class="card">
      <div class="label">Today's word</div>
      <div class="big-te">${esc(w.te)}</div>
      <div class="tr">${esc(w.tr)}</div>
      <div class="en" id="wotd-en" style="visibility:hidden">${esc(w.en)}</div>
      ${w.note ? `<div class="note" id="wotd-note" hidden>💡 ${esc(w.note)}</div>` : ""}
      <div class="row">
        <button class="btn ghost" id="wotd-say">🔊 Hear it</button>
        <button class="btn" id="wotd-reveal">Guess, then reveal</button>
      </div>
      <div class="row"><button class="btn ghost" id="wotd-next" hidden>Now try the quiz →</button></div>
    </div>`;
  $("#wotd-say").onclick = () => speak(w.te);
  $("#wotd-reveal").onclick = () => {
    $("#wotd-en").style.visibility = "visible";
    $("#wotd-note")?.removeAttribute("hidden");
    $("#wotd-reveal").hidden = true;
    $("#wotd-next").hidden = false;
    store.set("wotd:" + DATE_KEY, true);
  };
  $("#wotd-next").onclick = () => showView("quiz");
  if (store.get("wotd:" + DATE_KEY)) $("#wotd-reveal").click();
}

// ---------- 2. Quiz (Easy / Hard) ----------
const QUIZ_LEN = 5;
function buildQuiz(mode) {
  const pool = mode === "easy" ? EASY_WORDS : HARD_WORDS;
  const rand = rng(`roju-quiz-${mode}-${DATE_KEY}`);
  const picks = shuffle(pool, rand).slice(0, QUIZ_LEN);
  return picks.map((w) => {
    const distractors = shuffle(pool.filter((x) => x.en !== w.en), rand).slice(0, 3).map((x) => x.en);
    return { word: w, options: shuffle([w.en, ...distractors], rand) };
  });
}

let quiz = null;
function renderQuizMenu() {
  const e = store.get(`quiz:easy:${DATE_KEY}`), h = store.get(`quiz:hard:${DATE_KEY}`);
  $("#view-quiz").innerHTML = `
    <div class="card">
      <div class="label">Pick your level</div>
      <div class="modes" style="margin-top:12px">
        <button class="mode ${e ? "done" : ""}" data-mode="easy"><b>🌱 Easy</b><small>Telugu + English letters<br>${e ? `Done: ${e.score}/${QUIZ_LEN}` : "everyday words"}</small></button>
        <button class="mode ${h ? "done" : ""}" data-mode="hard"><b>🌶️ Hard</b><small>Telugu script only<br>${h ? `Done: ${h.score}/${QUIZ_LEN}` : "feelings, family, food"}</small></button>
      </div>
      <p style="text-align:center;color:var(--muted);margin:0">5 words · 4 choices · new set every day</p>
    </div>`;
  document.querySelectorAll(".mode").forEach((b) => (b.onclick = () => startQuiz(b.dataset.mode)));
}

function startQuiz(mode) {
  const saved = store.get(`quiz:${mode}:${DATE_KEY}`);
  quiz = { mode, qs: buildQuiz(mode), i: 0, answers: [] };
  if (saved) { quiz.answers = saved.answers; return renderQuizResult(); }
  renderQuestion();
}

function renderQuestion() {
  const { qs, i, mode, answers } = quiz;
  const q = qs[i];
  const dots = qs.map((_, k) => `<span class="dot ${k < answers.length ? (answers[k] ? "ok" : "bad") : k === i ? "now" : ""}"></span>`).join("");
  $("#view-quiz").innerHTML = `
    <div class="card">
      <div class="progress">${dots}</div>
      <div class="label">${mode === "easy" ? "🌱 Easy" : "🌶️ Hard"} · What does this mean?</div>
      <div class="big-te">${esc(q.word.te)}</div>
      <div class="tr" id="q-tr" ${mode === "hard" ? "hidden" : ""}>${esc(q.word.tr)}</div>
      <div class="options">${q.options.map((o) => `<button class="opt">${esc(o)}</button>`).join("")}</div>
      <div class="row"><button class="btn ghost" id="q-say">🔊</button><button class="btn" id="q-next" hidden>${i === qs.length - 1 ? "See results" : "Next →"}</button></div>
    </div>`;
  $("#q-say").onclick = () => speak(q.word.te);
  document.querySelectorAll(".opt").forEach((btn) => {
    btn.onclick = () => {
      const right = btn.textContent === q.word.en;
      document.querySelectorAll(".opt").forEach((b) => {
        b.disabled = true;
        if (b.textContent === q.word.en) b.classList.add("correct");
      });
      if (!right) btn.classList.add("wrong");
      $("#q-tr").hidden = false; // reveal pronunciation after answering, even on hard
      quiz.answers.push(right);
      $("#q-next").hidden = false;
    };
  });
  $("#q-next").onclick = () => {
    quiz.i++;
    if (quiz.i < qs.length) renderQuestion();
    else {
      store.set(`quiz:${mode}:${DATE_KEY}`, { answers: quiz.answers, score: quiz.answers.filter(Boolean).length });
      bumpStreak();
      renderQuizResult();
    }
  };
}

function renderQuizResult() {
  const { qs, answers, mode } = quiz;
  const score = answers.filter(Boolean).length;
  const emoji = answers.map((a) => (a ? "🟩" : "🟥")).join("");
  const cheers = ["Parledu! Keep going 💪", "Parledu! 🙂", "Not bad! 👍", "Chala bagundi! 🎉", "Adbhutam! 🔥", "Sooper! Ammamma would be proud 🪔"];
  const shareText = `Roju రోజు ${DATE_KEY}\n${mode === "easy" ? "🌱 Easy" : "🌶️ Hard"} ${score}/${QUIZ_LEN}\n${emoji}\n${location.href.split("#")[0]}`;
  $("#view-quiz").innerHTML = `
    <div class="card result">
      <div class="label">${mode === "easy" ? "🌱 Easy" : "🌶️ Hard"} · ${DATE_KEY}</div>
      <div class="score">${score}/${QUIZ_LEN}</div>
      <div class="emoji">${emoji}</div>
      <div>${cheers[score]}</div>
      <div class="review">${qs.map((q, k) => `<div>${answers[k] ? "✅" : "❌"} <span class="te"><b>${esc(q.word.te)}</b></span> <i>${esc(q.word.tr)}</i> — ${esc(q.word.en)}</div>`).join("")}</div>
      <div class="row"><button class="btn" id="q-share">Share result</button><button class="btn ghost" id="q-back">Other level</button></div>
    </div>`;
  $("#q-share").onclick = () => share(shareText);
  $("#q-back").onclick = renderQuizMenu;
}

// ---------- 3. Akshara Match (letters ↔ sounds, timed) ----------
const PAIRS = 6;
let lm = null;
function renderLetters() {
  const best = store.get(`letters:${DATE_KEY}`);
  const pairs = shuffle(LETTERS, rng(`roju-letters-${DATE_KEY}`)).slice(0, PAIRS);
  $("#view-letters").innerHTML = `
    <div class="card" style="text-align:center">
      <div class="label">Akshara Match</div>
      <p>Match ${PAIRS} Telugu letters to their sounds as fast as you can.</p>
      ${best ? `<p>Today's best: <b>${best.time.toFixed(1)}s</b> (${best.misses} misses)</p>` : ""}
      <button class="btn" id="lm-start">${best ? "Play again" : "Start ⏱️"}</button>
    </div>`;
  $("#lm-start").onclick = () => startLetters(pairs);
}

function startLetters(pairs) {
  const rand = rng(`roju-letters-tiles-${DATE_KEY}`);
  const left = shuffle(pairs.map(([te], i) => ({ id: i, label: te })), rand);
  const right = shuffle(pairs.map(([, tr], i) => ({ id: i, label: tr })), rand);
  lm = { start: performance.now(), sel: null, matched: 0, misses: 0, timer: null };
  const tiles = left.map((l, k) => [l, right[k]]).flat();
  $("#view-letters").innerHTML = `
    <div class="card">
      <div class="timer" id="lm-timer">0.0s</div>
      <div class="grid">${tiles.map((t, k) => `<button class="tile" data-id="${t.id}" data-side="${k % 2 ? "r" : "l"}">${esc(t.label)}</button>`).join("")}</div>
    </div>`;
  lm.timer = setInterval(() => ($("#lm-timer").textContent = ((performance.now() - lm.start) / 1000).toFixed(1) + "s"), 100);
  document.querySelectorAll(".tile").forEach((tile) => {
    tile.onclick = () => {
      if (tile.classList.contains("matched")) return;
      if (tile.dataset.side === "l") speak(tile.textContent);
      if (!lm.sel || lm.sel.dataset.side === tile.dataset.side) {
        lm.sel?.classList.remove("sel");
        lm.sel = tile; tile.classList.add("sel"); return;
      }
      if (lm.sel.dataset.id === tile.dataset.id) {
        [lm.sel, tile].forEach((t) => { t.classList.remove("sel"); t.classList.add("matched"); });
        lm.matched++;
        if (lm.matched === PAIRS) finishLetters();
      } else {
        lm.misses++;
        [lm.sel, tile].forEach((t) => { t.classList.add("shake"); setTimeout(() => t.classList.remove("shake", "sel"), 300); });
      }
      lm.sel = null;
    };
  });
}

function finishLetters() {
  clearInterval(lm.timer);
  const time = (performance.now() - lm.start) / 1000;
  const best = store.get(`letters:${DATE_KEY}`);
  if (!best || time < best.time) store.set(`letters:${DATE_KEY}`, { time, misses: lm.misses });
  bumpStreak();
  const shareText = `Roju రోజు ${DATE_KEY}\n🔤 Akshara Match: ${time.toFixed(1)}s, ${lm.misses} misses\n${location.href.split("#")[0]}`;
  $("#view-letters").innerHTML = `
    <div class="card result">
      <div class="label">Akshara Match</div>
      <div class="score">${time.toFixed(1)}s</div>
      <div>${lm.misses === 0 ? "Flawless! 🎯" : `${lm.misses} miss${lm.misses > 1 ? "es" : ""}`}</div>
      <div class="row"><button class="btn" id="lm-share">Share</button><button class="btn ghost" id="lm-again">Play again</button></div>
    </div>`;
  $("#lm-share").onclick = () => share(shareText);
  $("#lm-again").onclick = renderLetters;
}

// ---------- Tabs ----------
function showView(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  if (lm?.timer && name !== "letters") { clearInterval(lm.timer); renderLetters(); }
}
document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => showView(t.dataset.view)));

renderHeader();
renderWord();
renderQuizMenu();
renderLetters();
