"use strict";
/* 펫생각 맞춤 제품 가이드
   - 제품·추천 기준은 learned.json에서 읽는다 (스마트스토어 문의를 learn/learn.py가 학습해서 만든 파일)
   - 입력값은 서버로 보내지 않고 이 브라우저 안에서만 쓴다 */

const BREEDS = {
  dog:["믹스견","말티즈","푸들","포메라니안","치와와","시츄","비숑 프리제","요크셔테리어","닥스훈트","웰시코기","시바견","진돗개","말티푸","골든리트리버","래브라도리트리버","보더콜리","프렌치불독","비글","슈나우저","스피츠","잭러셀테리어"],
  cat:["코리안숏헤어","러시안블루","페르시안","브리티시숏헤어","스코티시폴드","먼치킨","랙돌","샴","아비시니안","노르웨이숲","벵갈","메인쿤","믹스묘"]
};
/* 나이 구간: [min, max) 살 */
const AGES = [
  {k:"young", label:"1살 미만", min:0, max:1},
  {k:"adult", label:"1–6살", min:1, max:7},
  {k:"mid", label:"7–10살", min:7, max:11},
  {k:"old", label:"11살 이상", min:11, max:Infinity}
];
const CONCERNS = ["관절·디스크","눈·눈물","피부·피모","장·소화","구강","기관지·호흡","항산화·면역","기타"];
const CONCERN_SUB = {"관절·디스크":"걷기·계단","눈·눈물":"눈물 자국","피부·피모":"털·피부","장·소화":"배변·소화","구강":"입 냄새·치아","기관지·호흡":"기침·켁켁","항산화·면역":"활력 관리","기타":"직접 입력"};
const ICON = {
  dog:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 9 5 7l1 9 4 2"/><path d="M23 9l4-2-1 9-4 2"/><path d="M10 10c1.5-2 3.5-3 6-3s4.5 1 6 3c1 2 1 7 0 10-1 3-3.5 5-6 5s-5-2-6-5c-1-3-1-8 0-10z"/><circle cx="13" cy="15" r=".8"/><circle cx="19" cy="15" r=".8"/><path d="M14.5 20h3l-1.5 1.5z"/></svg>',
  cat:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 13 7 5l6 4"/><path d="M24 13l1-8-6 4"/><path d="M8 13c0-3 3.5-5 8-5s8 2 8 5v4c0 5-3.6 8-8 8s-8-3-8-8z"/><circle cx="13" cy="16" r=".8"/><circle cx="19" cy="16" r=".8"/><path d="M15 19.5h2l-1 1z"/><path d="M5 18h5M5 21l5-1M27 18h-5M27 21l-5-1"/></svg>'
};

let L = null; // learned.json
let loadState = "loading"; // loading | ok | error
const DEBUG = new URLSearchParams(location.search).has("debug");

const S = {view:"form", species:null, breed:"", age:null, weight:"", concerns:[], etc:"",
  allergy:"", disease:"", steroid:null, showAnyway:false, extraOpen:false};

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const PH_RE = /\{[^}]+\}/g;
const hasPh = s => /\{[^}]+\}/.test(String(s));
const ph = s => esc(s).replace(PH_RE, m => `<span class="ph">${m}</span>`); // 자리표시자 강조
const filled = v => typeof v === "string" && v.trim() !== "";
const strList = v => Array.isArray(v) ? v.filter(filled) : [];
const spName = s => s === "dog" ? "강아지" : "고양이";
const breedWord = () => S.species === "dog" ? "견종" : S.species === "cat" ? "묘종" : "품종";
const youngName = () => S.species === "dog" ? "퍼피" : S.species === "cat" ? "키튼" : "퍼피·키튼";
const ageLabel = a => a.k === "young" ? `${youngName()} (1살 미만)` : a.label;
const kg = () => { const w = parseFloat(S.weight); if (isNaN(w)) return null; const r = Math.round(w); return r >= 1 ? r : null; };

function missing(){
  if (!S.species) return "강아지·고양이를 먼저 골라 주세요";
  if (!S.breed.trim()) return `${breedWord()}을 입력해 주세요`;
  if (!S.age) return "나이를 골라 주세요";
  if (kg() === null) return "체중을 입력해 주세요";
  if (!S.concerns.length) return "관심 분야를 1개 이상 골라 주세요";
  return null;
}

function go(view){ S.view = view; S.showAnyway = false; render(); window.scrollTo({top:0}); }

function setCta(){
  const c = $("#cta");
  if (S.view === "result"){
    c.disabled = false;
    c.innerHTML = "<b>다시 고르기</b><small>입력한 정보는 그대로 남아 있어요</small>";
    c.onclick = () => go("form");
    return;
  }
  const m = missing();
  c.disabled = !!m;
  c.innerHTML = `<b>맞춤 제품 보기</b><small>${esc(m || "입력한 정보로 제품을 찾아볼게요")}</small>`;
  c.onclick = () => { if (!missing()) go("result"); };
}

function render(){
  if (S.view === "result"){ renderResult(); setCta(); return; }
  const y = window.scrollY;
  const list = S.species ? BREEDS[S.species] : [];
  const sel = (k, v) => `aria-pressed="${S[k] === v}"`;
  $("#app").innerHTML = `
  <div class="hero"><h1>우리 아이에게 맞는<br>펫생각 제품을 찾아드려요</h1>
    <p class="lead">품종·체중만 입력하면 나머지는 버튼 몇 번이면 돼요</p></div>

  <section class="q"><div class="qh"><h2>누구와 함께하세요?</h2></div>
    <div class="cards c2">
      <button class="opt tall" type="button" data-k="species" data-v="dog" ${sel("species","dog")}>${ICON.dog}<b>강아지</b></button>
      <button class="opt tall" type="button" data-k="species" data-v="cat" ${sel("species","cat")}>${ICON.cat}<b>고양이</b></button>
    </div></section>

  <section class="q"><div class="qh"><h2><label for="breed">${breedWord()}</label></h2><span class="r">혼종·목록에 없으면 직접 입력</span></div>
    <input type="text" id="breed" list="breedlist" ${S.species ? "" : "disabled"} autocomplete="off" value="${esc(S.breed)}"
      placeholder="${S.species ? (S.species === "dog" ? "예: 치와와, 믹스견" : "예: 코리안숏헤어") : "강아지·고양이를 먼저 골라 주세요"}">
    <datalist id="breedlist">${list.map(b => `<option value="${esc(b)}">`).join("")}</datalist>
    ${S.species ? `<div class="chips">${list.slice(0,6).map(b => `<button class="chip" type="button" data-k="breed" data-v="${esc(b)}" ${sel("breed", b)}>${esc(b)}</button>`).join("")}</div>` : ""}
  </section>

  <section class="q"><div class="qh"><h2>몇 살이에요?</h2></div>
    <div class="cards c4">${AGES.map(a => `<button class="opt" type="button" data-k="age" data-v="${a.k}" ${sel("age", a.k)}><b>${a.k === "young" ? youngName() : a.label}</b>${a.k === "young" ? "<small>1살 미만</small>" : ""}</button>`).join("")}</div>
  </section>

  <section class="q"><div class="qh"><h2><label for="w">지금 체중은요?</label></h2><span class="r" id="wr"></span></div>
    <div class="row"><input type="number" id="w" min="1" step="1" inputmode="decimal" placeholder="예: 5" value="${esc(S.weight)}"><span class="unit">kg</span></div>
    <p class="hint">라벨에 체중 조건이 있는 제품을 확인할 때만 써요.</p>
  </section>

  <section class="q"><div class="qh"><h2>어떤 부분이 걱정되세요?</h2><span class="r ok">여러 개 골라도 돼요</span></div>
    <div class="cards cc">${CONCERNS.map(c => `<button class="opt" type="button" data-c="${esc(c)}" aria-pressed="${S.concerns.includes(c)}"><b>${esc(c)}</b><small>${esc(CONCERN_SUB[c])}</small></button>`).join("")}</div>
    <div ${S.concerns.includes("기타") ? "" : "hidden"} style="margin-top:8px"><input type="text" id="etc" aria-label="기타 관심 분야" value="${esc(S.etc)}" placeholder="기타 관심 분야를 적어 주세요"></div>
  </section>

  <details class="extra" id="extra" ${S.extraOpen ? "open" : ""}><summary>추가 정보 <span>(선택 입력)</span></summary>
    <label class="f" for="al">알레르기</label><input type="text" id="al" value="${esc(S.allergy)}" placeholder="예: 닭고기, 소고기">
    <label class="f" for="ds">진단받은 질환</label><input type="text" id="ds" value="${esc(S.disease)}" placeholder="동물병원에서 진단받은 내용">
    <label class="f">스테로이드를 복용하고 있나요?</label>
    <div class="chips" style="margin-top:0">${[["yes","복용 중이에요"],["no","복용하지 않아요"]].map(([v,t]) => `<button class="chip" type="button" data-k="steroid" data-v="${v}" ${sel("steroid", v)}>${t}</button>`).join("")}</div>
  </details>`;

  const app = $("#app");
  app.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
    const k = b.dataset.k, v = b.dataset.v;
    if (k === "species" && S.species !== v) S.breed = "";
    S[k] = (k === "steroid" && S[k] === v) ? null : v; // 스테로이드는 한 번 더 누르면 해제
    render();
  });
  app.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
    const c = b.dataset.c;
    S.concerns = S.concerns.includes(c) ? S.concerns.filter(x => x !== c) : [...S.concerns, c];
    render();
  });
  const bind = (id, k, after) => { const e = $("#" + id); if (e) e.oninput = () => { S[k] = e.value; after && after(); }; };
  const weightHint = () => { $("#wr").textContent = kg() !== null ? `${kg()}kg으로 반영돼요` : "1kg 단위로 입력"; };
  bind("breed", "breed", () => { app.querySelectorAll('[data-k="breed"]').forEach(c => c.setAttribute("aria-pressed", String(c.dataset.v === S.breed))); setCta(); });
  bind("w", "weight", () => { weightHint(); setCta(); });
  bind("etc", "etc"); bind("al", "allergy"); bind("ds", "disease");
  weightHint();
  $("#extra").ontoggle = e => S.extraOpen = e.target.open;
  setCta();
  window.scrollTo({top:y});
}

/* ───────── 추천 로직: 보호자 문의 학습 결과(learned.json) 기준 ───────── */
const cleanName = n => String(n || "").replace(/^\[[^\]]*\]\s*/, "").replace(/,\s*\d+\s*(정|개|포|캡슐|g|ml|팩|p).*$/i, "").trim();
const num = v => (typeof v === "number" ? v : 0);
const fmt = n => Math.round(n).toLocaleString("ko-KR");

function breedKey(){
  const t = S.breed.replace(/\s/g, "");
  const m = Object.keys((L.breed[S.species]) || {}).find(b => t && (t.includes(b.replace(/\s/g, "")) || b.replace(/\s/g, "").includes(t)));
  return m || null;
}

function match(){
  const log = [];
  const sp = S.species, pick = S.concerns.filter(c => c !== "기타"); // 기타는 자동 매칭하지 않음
  const ageMap = (L.age[sp] || {})[S.age] || {};
  const bk = breedKey(), breedMap = bk ? (L.breed[sp] || {})[bk] || {} : {};
  const ageMax = Math.max(1, ...Object.values(ageMap)), breedMax = Math.max(1, ...Object.values(breedMap));
  let rows = [];
  for (const [key, p] of Object.entries(L.products)){
    if (!p.species.includes(sp)) { log.push(`✗ ${key} 대상 동물 다름`); continue; }
    const hit = pick.filter(c => p.tags.includes(c));
    if (!hit.length) { log.push(`✗ ${key} 관심 분야 연결 없음`); continue; }
    const isSet = p.family.startsWith("세트:");
    if (isSet && hit.length < 2) { log.push(`✗ ${key} 세트는 2개 이상 겹칠 때만`); continue; }
    const per = hit.map(c => [c, num(((L.concern[sp] || {})[c] || {})[key])]);
    const base = per.reduce((s, [, v]) => s + v, 0) + p.inquiries * 0.03 + p.recommendedInAnswers * 2;
    const ageR = num(ageMap[key]) / ageMax, breedR = num(breedMap[key]) / breedMax;
    const score = base * (1 + 0.4 * ageR + 0.3 * breedR) * (isSet ? 0.6 : 1);
    rows.push({key, p, hit, per, ageN:num(ageMap[key]), breedN:num(breedMap[key]), bk, score, notes:[]});
    log.push(`✓ ${key} 점수 ${score.toFixed(1)} (고민 ${base.toFixed(1)}, 나이 ${ageR.toFixed(2)}, 품종 ${breedR.toFixed(2)})`);
  }
  rows.sort((x, y) => y.score - x.score);
  // 같은 관심 분야만 겹치는 제품이 너무 많아지지 않게: 관심 분야마다 최대 2개, 전체 최대 5개
  const perC = {}, out = [];
  for (const r of rows){
    if (out.length >= 5) break;
    const room = r.hit.some(c => (perC[c] || 0) < 2);
    if (!room) continue;
    r.hit.forEach(c => perC[c] = (perC[c] || 0) + 1);
    out.push(r);
  }
  if (S.concerns.includes("기타")) log.push(`※ 기타(${S.etc || "내용 없음"})는 자동 연결하지 않음`);
  return {rows: out, log};
}

function cardHTML({p, hit, per, ageN, breedN, bk}){
  const tags = [...new Set(p.species.map(s => s === "dog" ? "강아지용" : "고양이용"))].map(t => `<span class="tag">${t}</span>`).join("");
  const img = filled(p.image) ? `<div class="pimg"><img src="${esc(p.image)}?type=f300" alt="${esc(cleanName(p.name))}" loading="lazy" onerror="this.parentNode.remove()"></div>` : "";
  const link = /^https?:\/\//i.test(p.url || "") ? `<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">스마트스토어에서 자세히 보기</a>` : "";
  const why = per.map(([c, v]) => `<li>선택하신 <b>${esc(c)}</b> 고민으로 ${v >= 20 ? "보호자들이 많이 " : "보호자들이 "}문의한 제품이에요${v >= 1 ? ` <small>(관련 문의·상담 ${fmt(v)}건)</small>` : ""}</li>`);
  const age = AGES.find(a => a.k === S.age);
  if (ageN >= 3) why.push(`<li><b>${esc(ageLabel(age))}</b> 아이 보호자 문의가 있었던 제품이에요 <small>(${fmt(ageN)}건)</small></li>`);
  if (bk && breedN >= 2) why.push(`<li><b>${esc(bk)}</b> 보호자 문의가 있었던 제품이에요 <small>(${fmt(breedN)}건)</small></li>`);
  const userNotes = [];
  if (S.allergy.trim()) userNotes.push("라벨 원료를 꼭 확인해 주세요");
  if (S.steroid === "yes") userNotes.push("급여 전 수의사와 상의해 주세요");
  return `
  <article class="pcard">${img}
    <div class="pin">
      <div><div class="pname">${esc(cleanName(p.name))}</div><div class="tags">${tags}</div></div>
      <div class="sec"><h4>이렇게 연결됐어요</h4><ul>${why.join("")}</ul></div>
      ${userNotes.length ? `<div class="note warn"><b>확인해 주세요</b><br>${userNotes.map(esc).join("<br>")}</div>` : ""}
      ${link}
    </div></article>`;
}

function renderResult(){
  const bucket = AGES.find(a => a.k === S.age);
  const sum = [spName(S.species), S.breed.trim(), ageLabel(bucket), `${kg()}kg`].map(x => `<span>${esc(x)}</span>`).join("")
    + S.concerns.map(c => `<span>${esc(c === "기타" ? `기타: ${S.etc.trim() || "-"}` : c)}</span>`).join("")
    + (S.steroid === "yes" ? "<span>스테로이드 복용 중</span>" : "");
  const disc = `<p class="disc">추천 결과는 펫생각 스마트스토어에 들어온 보호자 문의${L ? ` ${fmt(L.totalInquiries)}건(${esc(L.updated)} 기준)` : ""}을 바탕으로 한 상품 안내이며, 질병 진단이나 치료 권고가 아니에요. 급여량은 제품 라벨을 기준으로 해 주세요.</p>`;

  if (loadState !== "ok"){
    $("#app").innerHTML = `<div class="hero"><div class="sum">${sum}</div></div>
      <div class="note warn"><b>${loadState === "loading" ? "제품 정보를 불러오는 중이에요" : "제품 정보를 불러오지 못했어요"}</b><br>
      ${loadState === "loading" ? "잠시만 기다려 주세요." : "잠시 후 다시 시도해 주세요."}</div>${disc}`;
    return;
  }

  const {rows, log} = match();
  const vetFirst = !!S.disease.trim();
  const showCards = !vetFirst || S.showAnyway;
  const demo = false;

  let h = `<div class="hero">${demo ? `<span class="badge">예시 데이터로 동작 중</span>` : ""}
    <h1${demo ? ' style="margin-top:8px"' : ""}>${esc(S.breed.trim())} 보호자님께<br>${rows.length ? "맞는 제품을 찾았어요" : "드리는 안내예요"}</h1><div class="sum">${sum}</div></div>`;

  if (vetFirst) h += `<div class="note warn" style="margin-bottom:14px"><b>먼저 동물병원 상담을 권해요</b><br>
    진단받은 질환(${esc(S.disease.trim())})이 있다면 제품 급여 전 담당 수의사와 먼저 상의해 주세요.
    ${rows.length && !S.showAnyway ? `<br><button class="chip" type="button" id="anyway">제품 정보만 보기 (${rows.length}개)</button>` : ""}</div>`;

  if (!rows.length){
    h += `<div class="empty"><div class="big">?</div><h2>조건에 맞는 등록 제품을 찾지 못했어요</h2>
      <p class="lead">선택하신 관심 분야로 보호자 문의가 쌓인 제품이 아직 없어요. 관심 분야를 바꿔 다시 찾아보세요.</p></div>`;
  } else if (showCards){
    h += rows.map(cardHTML).join("");
  }
  h += disc;

  if (DEBUG) h += `<details class="dev"><summary>개발용 — 매칭 로그</summary><div class="log">${esc(
    `입력: ${JSON.stringify({species:S.species, breed:S.breed, age:S.age, kg:kg(), concerns:S.concerns, allergy:!!S.allergy.trim(), disease:vetFirst, steroid:S.steroid})}\n\n${log.join("\n")}\n\n노출: ${rows.map(r => r.key).join(", ") || "없음 → 결과 없음 화면"}`)}</div></details>`;

  $("#app").innerHTML = h;
  const a = $("#anyway");
  if (a) a.onclick = () => { S.showAnyway = true; render(); };
}

async function init(){
  render();
  try {
    if (window.LEARNED) L = window.LEARNED; // learned.js (더블클릭으로 열 때)
    else { const res = await fetch("learned.json", {cache:"no-cache"}); if (!res.ok) throw new Error(res.status); L = await res.json(); }
    if (!L || typeof L.products !== "object") throw new Error("learned.json 형식 오류");
    loadState = "ok";
  } catch (e) {
    loadState = "error";
    console.error("learned.json 불러오기 실패:", e);
  }
  if (S.view === "result") render();
}
init();
