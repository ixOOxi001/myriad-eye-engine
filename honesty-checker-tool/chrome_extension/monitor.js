// 만안엔진 정직성체커 — 실시간 감시 모드
//
// Verdent / Gemini / GenSpark 같은 채팅 페이지에 상시 주입되어, 새 AI 응답이
// "완성"될 때마다(스트리밍이 멈춘 것으로 판단될 때마다) 그 안에 [만반]과
// [만증]이 둘 다 있는지 확인한다. 없으면 화면에 경고 배너를 띄운다.
//
// 핵심 원칙(기존 background.js의 grabText와 동일): 사이트별 클래스명에 의존하지
// 않는다. 대신 "가장 최근에 변한 DOM 위치"에서 부모를 타고 올라가며 6000자를
// 넘지 않는 선에서 "말풍선 하나" 크기를 찾는다.
//
// v2 추가: "태그는 있는데 내용이 부실해지는" 열화(degrade) 패턴 감지.
// - [9요소]적용: 뒤 항목 개수가 연속으로 항상 0개 또는 항상 9개 전부만 반복되면 의심
// - [검증]확인함: 뒤에 구체적 근거(파일/코드/수치 등) 없이 감정적·수사적 어휘만 있으면 의심
// 둘 다 "최근 몇 개 메시지 연속" 관찰 후에만 배너를 띄운다(오탐 방지, 1회성 무시).

(function () {
  if (window.__spiderEyeMonitorInjected) return;
  window.__spiderEyeMonitorInjected = true;

  const HOST_ID_MISSING = "spider-eye-monitor-banner-host";
  const HOST_ID_DEGRADE = "spider-eye-degrade-banner-host";
  const HOST_ID_COUNTER = "spider-eye-turn-counter-host";
  const MAX_BUBBLE_TEXT = 6000; // grabText와 동일한 상한 — 이보다 커지면 다른 메시지/전체 페이지로 넘어간 것으로 간주
  const MAX_HOPS = 8;
  const DEBOUNCE_MS = 1500; // 스트리밍 중엔 계속 바뀌므로, 이 시간 동안 추가 변화 없으면 "완성"으로 판단
  const MIN_TEXT_LEN = 15; // 너무 짧은 텍스트(버튼 라벨 등)는 메시지로 보지 않음
  const BANNER_LIFETIME_MS = 7000;
  const DEGRADE_BANNER_LIFETIME_MS = 15000; // 복사할 시간이 필요하므로 좀 더 길게

  // 열화 감지 판단에 쓰는 "연속 몇 개" 기준 및 이력 보관 길이
  const CONSECUTIVE_THRESHOLD = 3;
  const HISTORY_KEEP = 5;

  const CORRECTION_PROMPT =
    "잠깐, 방금 응답 다시 확인해줘. [9요소]에 적어둔 적용 항목마다 실제로 어떤 근거로 " +
    "그렇게 판단했는지 구체적으로(파일/코드/수치 등) 다시 설명해줘. 근거가 약하면 정직하게 " +
    '"미확인"으로 정정하고, 필요하면 훈련 1단계로 돌아가서 다시 시작해도 돼.\n\n' +
    "그리고 능동 7개(①~⑥+⑨) 중 실제로 몇 개를 켰는지 다시 세어봐 — ⑦전개도·⑧청사진은 " +
    "패시브라 이 카운트에서 빠져. 4개 미만이면 그건 생략이 아니라 이완이야. " +
    "⚠️[하한미달] 능동 N개 — 사유:(구체적 이유) 형태로 밝히든지, 4개 이상으로 다시 하든지 둘 중 하나만 해줘. " +
    '"간단해서"는 사유가 아니야 — 간단할수록 4개 켜는 데 드는 부담이 없으니까.';

  // ==================================================================
  // 자동 재요청 [2026-08-17 신설]
  // ------------------------------------------------------------------
  // 배경: 지시자님이 무서움을 느낀 지점 — 고지능 모델일수록 자율판단이 좋을
  // 때도 있지만 나쁠 때도 티가 안 남. Gemini 유료는 시스템 개입이 잦아
  // API/하네스로 "진짜 통제"가 불가능하고, 사용자 본인도 그 서비스의
  // 권한자가 아니다. 그래서 할 수 있는 최대치는 "만들어진 걸 못 보게
  // 막는다"가 아니라 "어긋났을 때 방향을 다시 잡아준다" — 위반이 감지되면
  // 사용자 클릭 없이 정정 프롬프트를 채팅창에 직접 넣어 재요청한다.
  //
  // booster.js의 입력창 탐지/전송 로직을 그대로 재사용한다(이미 검증된
  // 코드, 사이트별 셀렉터 없이 범용 휴리스틱만 사용). 각 파일은 독립
  // IIFE라 함수를 공유할 수 없어 이 파일에도 동일 로직을 둔다.
  //
  // 안전장치 (booster.js와 동일 원칙 + 추가):
  // - 사용자가 방금 입력 중이었으면 건너뜀
  // - 입력창이 비어있지 않으면 건너뜀
  // - 쿨다운 없이 연속 재요청하지 않음(마지막 재요청 후 최소 간격)
  // - 같은 세션에서 연속 재요청이 일정 횟수를 넘으면 멈춤(무한루프 방지 —
  //   AI가 계속 위반하면 이건 도구로 못 고치는 상태이니 사용자가 봐야 함)
  // ==================================================================
  const ORIGIN = location.origin;
  const AUTO_RESEND_KEY = "autoResend:" + ORIGIN;
  const AUTO_RESEND_COOLDOWN_MS = 15000;
  const AUTO_RESEND_MAX_STREAK = 3;
  const AUTO_RESEND_INPUT_GUARD_MS = 4000;

  let autoResendEnabled = false;
  let lastAutoResendAt = 0;
  let autoResendStreak = 0;
  let lastAutoResendUserActivityAt = 0;

  function markAutoResendActivity(e) {
    if (isUserInputArea(e.target)) lastAutoResendUserActivityAt = Date.now();
  }
  document.addEventListener("input", markAutoResendActivity, true);
  document.addEventListener("keydown", markAutoResendActivity, true);

  function arGetElementText(el) {
    if (el.tagName === "TEXTAREA") return el.value || "";
    return el.textContent || "";
  }
  function arIsElementEmpty(el) {
    return arGetElementText(el).trim().length === 0;
  }
  function arFindChatInputCandidate() {
    const selector = 'textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]';
    const all = Array.from(document.querySelectorAll(selector));
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const scored = [];
    for (const el of all) {
      if (el.disabled || el.readOnly) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (parseFloat(style.opacity || "1") === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 16) continue;
      if (rect.bottom < viewportH * 0.25) continue;
      if (rect.top > viewportH || rect.bottom < 0) continue;
      const score = rect.bottom + rect.width * 0.15;
      scored.push({ el, rect, score });
    }
    if (scored.length === 0) return null;
    scored.sort((a, b) => b.score - a.score);
    if (scored.length === 1) return scored[0].el;
    const top = scored[0];
    const second = scored[1];
    const gap = top.score - second.score;
    const requiredGap = Math.max(top.score * 0.12, 60);
    if (gap < requiredGap) return null;
    return top.el;
  }
  function arSetTextareaValue(el, text) {
    const proto = window.HTMLTextAreaElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function arSetContentEditableValue(el, text) {
    el.focus();
    el.textContent = text;
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    } catch (e) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function arFillInput(el, text) {
    if (el.tagName === "TEXTAREA") arSetTextareaValue(el, text);
    else arSetContentEditableValue(el, text);
  }
  const AR_SEND_WORD_RE = /(send|전송|submit|보내기)/i;
  function arLooksLikeSendButton(btn) {
    if (!btn) return false;
    const aria = (btn.getAttribute("aria-label") || "").trim();
    const title = (btn.getAttribute("title") || "").trim();
    const text = (btn.textContent || "").trim();
    const type = (btn.getAttribute("type") || "").trim();
    if (type === "submit") return true;
    if (AR_SEND_WORD_RE.test(aria)) return true;
    if (AR_SEND_WORD_RE.test(title)) return true;
    if (text && AR_SEND_WORD_RE.test(text)) return true;
    return false;
  }
  function arFindSendButton(inputEl) {
    const form = inputEl.closest ? inputEl.closest("form") : null;
    let scope = form;
    if (!scope) {
      let el = inputEl.parentElement;
      let hops = 0;
      while (el && hops < 5) {
        if (el.querySelector("button, [role='button']")) { scope = el; break; }
        el = el.parentElement;
        hops++;
      }
    }
    if (!scope) return null;
    const buttons = Array.from(scope.querySelectorAll("button, [role='button']"));
    const candidates = buttons.filter(arLooksLikeSendButton);
    if (candidates.length === 1) return candidates[0];
    return null;
  }
  function arDispatchEnter(el) {
    const opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  // 배너에 이미 있는 복사 버튼과 별개로, 토글이 켜져 있으면 이걸 호출해서
  // 자동으로 채팅에 정정 프롬프트를 넣고 전송한다. 실패하면 조용히
  // 넘어간다(기존 배너의 "복사" 버튼이 항상 수동 대안으로 남아있음).
  function attemptAutoResend(promptText, reasonLabel) {
    if (!autoResendEnabled) return;
    const now = Date.now();
    if (now - lastAutoResendUserActivityAt < AUTO_RESEND_INPUT_GUARD_MS) {
      console.log("[정직성체커/자동재요청] 사용자 입력 직후 — 건너뜀");
      return;
    }
    if (now - lastAutoResendAt < AUTO_RESEND_COOLDOWN_MS) {
      console.log("[정직성체커/자동재요청] 쿨다운 중 — 건너뜀");
      return;
    }
    if (autoResendStreak >= AUTO_RESEND_MAX_STREAK) {
      console.log("[정직성체커/자동재요청] 연속 재요청 한도 도달 — 사용자 개입 필요, 자동 재요청 중단");
      return;
    }
    const inputEl = arFindChatInputCandidate();
    if (!inputEl) {
      console.log("[정직성체커/자동재요청] 입력창 후보 불확실 — 건너뜀");
      return;
    }
    if (!arIsElementEmpty(inputEl)) {
      console.log("[정직성체커/자동재요청] 입력창에 기존 내용 있음 — 건너뜀");
      return;
    }
    arFillInput(inputEl, promptText);
    const sendBtn = arFindSendButton(inputEl);
    if (sendBtn) sendBtn.click();
    else arDispatchEnter(inputEl);
    lastAutoResendAt = now;
    autoResendStreak++;
    console.log("[정직성체커/자동재요청] 정정 프롬프트 자동 재전송(" + reasonLabel + "), 연속 " + autoResendStreak + "회");
  }

  // 위반 없이 넘어간 턴에서는 스트릭을 초기화 — "연속 실패"만 잡는 게 목적이지
  // 하루 종일 재요청을 아예 막으려는 게 아니다.
  function resetAutoResendStreakIfClean(hasViolationThisTurn) {
    if (!hasViolationThisTurn) autoResendStreak = 0;
  }

  function loadAutoResendState() {
    const query = {};
    query[AUTO_RESEND_KEY] = false;
    chrome.storage.local.get(query, (res) => {
      autoResendEnabled = !!res[AUTO_RESEND_KEY];
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && AUTO_RESEND_KEY in changes) {
        autoResendEnabled = !!changes[AUTO_RESEND_KEY].newValue;
        console.log("[정직성체커/자동재요청]", autoResendEnabled ? "켜짐" : "꺼짐");
      }
    });
  }
  try { loadAutoResendState(); } catch (e) { console.error("[정직성체커/자동재요청] 상태 로드 실패:", e); }

  // ==================================================================
  // 턴 카운터 + 붕괴 시점 기록 [2026-08-17 신설]
  // ------------------------------------------------------------------
  // 배경: "언제쯤 새 창으로 넘어가야 할지" 판단할 기준선이 없다는 문제.
  // 글자수는 판단하기 애매하다는 지시자님 피드백 → 사람이 세기 쉬운
  // "턴 수"로 바꾸고, 정확한 임계값을 지어내는 대신 **실제로 무너진
  // 시점을 사이트별로 계속 기록해서 경험치 기준선을 스스로 쌓는다.**
  //
  // "무너졌다"의 정의: 1회성 실수가 아니라, 이미 만든 열화(3턴 연속)·
  // 절차의심(5턴 마찰없음 등) 감지기가 **이번 세션에서 처음** 울린 시점.
  // 새 감지 로직을 만들지 않고 기존 것을 재사용한다.
  // ==================================================================
  let totalTurnCount = 0;
  let collapseLoggedThisSession = false;
  const COLLAPSE_LOG_KEY = "collapseLog:" + ORIGIN;
  const COLLAPSE_LOG_MAX = 20; // 사이트별 최근 N건만 보관

  function updateTurnCounterBadge() {
    let host = document.getElementById(HOST_ID_COUNTER);
    let shadow;
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID_COUNTER;
      host.style.all = "initial";
      host.style.position = "fixed";
      host.style.right = "0";
      host.style.top = "0";
      host.style.zIndex = "2147483647";
      host.style.pointerEvents = "none";
      document.documentElement.appendChild(host);
      shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `
        .badge {
          font-family: -apple-system, "Segoe UI", "Malgun Gothic", "맑은 고딕", sans-serif;
          margin: 10px;
          padding: 5px 10px;
          background: rgba(20, 20, 30, 0.75);
          color: #b8c4d9;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          user-select: none;
        }
      `;
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.id = "count-text";
      shadow.appendChild(style);
      shadow.appendChild(badge);
    } else {
      shadow = host.shadowRoot;
    }
    const badgeEl = shadow.getElementById("count-text");
    if (badgeEl) badgeEl.textContent = "[M.E.E] 턴 " + totalTurnCount;
  }

  // 열화·절차의심이 이번 세션에서 처음 울린 시점의 턴 번호를 사이트별로 저장.
  // 매번 저장하지 않고 "이번 세션의 첫 발생"만 기록 — 같은 세션에서 계속
  // 울리는 걸 전부 쌓으면 잡음만 늘어나고, 정작 필요한 건 "언제부터
  // 무너지기 시작했나"라는 시작점 하나뿐이다.
  function logCollapseOnce(kind) {
    if (collapseLoggedThisSession) return;
    collapseLoggedThisSession = true;
    const entry = { turn: totalTurnCount, kind, ts: Date.now() };
    try {
      chrome.storage.local.get({ [COLLAPSE_LOG_KEY]: [] }, (res) => {
        const list = res[COLLAPSE_LOG_KEY] || [];
        list.push(entry);
        while (list.length > COLLAPSE_LOG_MAX) list.shift();
        chrome.storage.local.set({ [COLLAPSE_LOG_KEY]: list });
      });
      console.log("[정직성체커/붕괴기록] 턴 " + totalTurnCount + "에서 첫 " + kind + " 감지 — 기록됨");
    } catch (e) {
      console.error("[정직성체커/붕괴기록] 저장 실패:", e);
    }
  }

  const TAG_MISSING_RESEND_PROMPT =
    "[만반][만증] 태그가 안 보여. 답변 첫 줄에 [만증]AI:회사/모델명부터 다시 붙여서 같은 내용을 다시 답해줘.";

  let enabled = true;
  let debounceTimer = null;
  let pendingRecords = [];
  let lastCheckedText = "";
  let baselineRecorded = false; // 첫 안정화는 "페이지 로드 직후 기존 내용"일 수 있으므로 경고하지 않고 기준선으로만 기록

  // ---- 열화 감지용 세션 상태 (새로고침하면 리셋되어도 무방) ----
  let nineElementHistory = []; // 최근 [9요소]적용: 개수들 (0~9)
  let evidenceWeakHistory = []; // 최근 [검증]확인함: 근거부족 여부(boolean)들
  let floorBreachHistory = []; // 최근 "능동 4개 하한 미달인데 신고도 없음" 여부(boolean)들 [2026-08-16 신설]

  // ==================================================================
  // 턴 이력 (2026-08-17 신설) — "형식 검사"에서 "절차 검사"로 넘어가기 위한 토대
  // ------------------------------------------------------------------
  // 왜 필요한가: 기존 감시는 응답 하나씩 따로 본다. 그래서 라벨 형식만 보인다.
  // 그런데 "만안엔진을 실제로 썼는가"의 흔적은 응답 안이 아니라 **턴과 턴 사이**에
  // 있다 — 승인을 거쳤나, 마찰이 있었나, 나중에 뒤집었나.
  //
  // 2026-08-17 실측: 한 AI(Opus 5)가 하루 종일 라벨을 정직해 보이게 채웠고
  // 기존 감시를 전부 통과했다. 실제로는 훈련 1단계를 한 번도 밟지 않고
  // 라벨을 사후에 붙인 상태였다. 사용자는 형식이 아니라 아래 3가지 흔적으로
  // 잡아냈다:
  //   ① 사후 발견 — 나중에 재검토해서 찾은 실수 = 그때 안 봤다는 증거
  //   ② 속도     — 단계를 밟았으면 안 나올 속도로 대량 산출물이 나옴
  //   ③ 마찰 없음 — 1단계를 밟으면 승인 요청으로 대화가 끊기는데 안 끊김
  // 셋 다 자기보고가 아니라 대화에 남은 흔적이라 **위조할 수 없다.**
  // 그래서 턴별 사실을 쌓아두고 흐름으로 판정한다.
  // ==================================================================
  const TURN_KEEP = 12; // 이력 보관 턴 수
  let turnHistory = []; // [{ askedApproval, outputScale, postHocHits, hasTags, activeCount, extActive, passiveReported, riskyEdit, ts }]

  function pushTurn(rec) {
    turnHistory.push(rec);
    while (turnHistory.length > TURN_KEEP) turnHistory.shift();
  }

  function isUserInputArea(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(
      'input, textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'
    );
  }

  function isOwnBanner(el) {
    return !!(
      el &&
      el.closest &&
      (el.closest("#" + HOST_ID_MISSING) || el.closest("#" + HOST_ID_DEGRADE))
    );
  }

  function elementOf(node) {
    if (!node) return null;
    return node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  }

  // background.js의 grabText 안 "부모를 타고 올라가며 말풍선 크기 찾기" 로직을
  // 그대로 응용. 차이점: 여기선 시작점이 "[만증]" 텍스트가 아니라 "방금 변한 노드".
  function findBubbleText(startNode) {
    let el = elementOf(startNode);
    if (!el) return null;
    if (isUserInputArea(el) || isOwnBanner(el)) return null;

    let best = el;
    let hops = 0;
    while (el && hops < MAX_HOPS) {
      const len = (el.innerText || "").length;
      if (len > MAX_BUBBLE_TEXT) break;
      best = el;
      el = el.parentElement;
      hops++;
    }
    const text = (best.innerText || "").trim();
    return text;
  }

  function makeBannerHost(hostId) {
    const existing = document.getElementById(hostId);
    if (existing) existing.remove();

    const host = document.createElement("div");
    host.id = hostId;
    // 페이지 스타일 상속을 최대한 차단
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.right = "0";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    document.documentElement.appendChild(host);
    return host;
  }

  function showBanner() {
    const host = makeBannerHost(HOST_ID_MISSING);
    // 열화 배너가 겹쳐 있으면 화면이 어수선해지므로, 태그 누락처럼 더 심각한
    // 신호가 뜨면 열화 배너는 접어둔다(최신/더 심각한 배너 우선).
    const degradeHost = document.getElementById(HOST_ID_DEGRADE);
    if (degradeHost) degradeHost.style.top = "70px";

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      .banner {
        pointer-events: auto;
        font-family: -apple-system, "Segoe UI", "Malgun Gothic", "맑은 고딕", sans-serif;
        margin: 12px;
        padding: 14px 40px 14px 16px;
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        color: #ffffff;
        border-radius: 10px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        font-size: 14px;
        font-weight: 600;
        line-height: 1.5;
        position: relative;
        max-width: 360px;
        word-break: keep-all;
        animation: spiderEyeSlideIn 0.25s ease-out;
      }
      @keyframes spiderEyeSlideIn {
        from { transform: translateX(24px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .close-btn {
        position: absolute;
        top: 6px;
        right: 8px;
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 16px;
        cursor: pointer;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 4px;
      }
      .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    `;

    const banner = document.createElement("div");
    banner.className = "banner";
    banner.textContent =
      "⚠️ [만반][만증] 누락 감지 — 일반 사고 프로세서로 전환됐을 수 있습니다";

    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.addEventListener("click", () => host.remove());
    banner.appendChild(closeBtn);

    shadow.appendChild(style);
    shadow.appendChild(banner);

    setTimeout(() => {
      if (host.isConnected) host.remove();
    }, BANNER_LIFETIME_MS);
  }

  // ==================================================================
  // 절차 의심 배너 [2026-08-17 신설]
  // ------------------------------------------------------------------
  // 기존 배너 2종과 색·문구를 일부러 다르게 한다:
  //   빨강(태그 누락) = 형식 위반 / 노랑(품질 저하) = 형식은 있으나 내용 부실
  //   보라(이것)      = **형식은 통과인데 절차가 비어 있음**
  // 오탐 가능성이 있으므로 단정하지 않고 "의심"으로만 쓴다.
  // ==================================================================
  const HOST_ID_PROCESS = "spider-eye-process-banner-host";
  const PROCESS_PROMPT =
    "잠깐. 방금까지의 흐름을 보면 절차를 건너뛴 것으로 보여. 확인해줘.\n" +
    "1) 이 작업에 들어가기 전에 훈련 1단계 한 줄을 내고 승인을 받았나? 안 받았으면 그렇다고 말해줘.\n" +
    "2) [9요소]/[확장6요소] 라벨을 작업 끝난 뒤에 붙였나, 시작 전에 선언했나? 사후 부착이면 사후라고 밝혀줘.\n" +
    "3) 되돌리기 어려운 작업(덮어쓰기·삭제·일괄수정)을 했다면, 사전에 무엇을 점검했는지 한 줄로 적어줘.\n" +
    "숨기고 싶은 게 있으면 그게 바로 말해야 하는 것이야. 먼저 밝히면 문제가 안 되지만, 넘어가면 은폐가 돼.";

  function showProcessBanner(reasons) {
    const host = makeBannerHost(HOST_ID_PROCESS);
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      .banner {
        pointer-events: auto;
        font-family: -apple-system, "Segoe UI", "Malgun Gothic", "맑은 고딕", sans-serif;
        margin: 12px; padding: 14px 40px 14px 16px;
        background: linear-gradient(135deg, #7b5cd6, #5b3fa8);
        color: #f4efff; border-radius: 10px;
        box-shadow: 0 6px 20px rgba(0,0,0,.35);
        font-size: 13px; font-weight: 600; line-height: 1.5;
        position: relative; max-width: 400px; word-break: keep-all;
        animation: spiderEyeSlideIn .25s ease-out;
      }
      @keyframes spiderEyeSlideIn {
        from { transform: translateX(24px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .close-btn {
        position: absolute; top: 6px; right: 8px;
        background: transparent; border: none; color: #f4efff;
        font-size: 16px; cursor: pointer; line-height: 1;
        padding: 4px 6px; border-radius: 4px;
      }
      .close-btn:hover { background: rgba(255,255,255,.18); }
      .sub { font-size: 11px; font-weight: 500; margin-top: 4px; opacity: .9; }
      .list { margin: 8px 0 0; padding-left: 18px; font-size: 11px; font-weight: 500; line-height: 1.5; }
      .list li { margin-bottom: 3px; }
      .prompt-box {
        margin-top: 10px; padding: 8px 10px;
        background: rgba(255,255,255,.14); border-radius: 6px;
        font-size: 11px; font-weight: 400; line-height: 1.45;
        max-height: 140px; overflow-y: auto;
        white-space: pre-wrap; word-break: break-word; user-select: text;
      }
      .copy-btn {
        margin-top: 8px; width: 100%; border: none; border-radius: 6px;
        padding: 7px 0; background: #2a1a52; color: #cdb8ff;
        font-size: 12px; font-weight: 700; cursor: pointer;
      }
      .copy-btn:hover { background: #3a2670; }
      .copy-btn.copied { background: #2ecc71; color: #103d20; }
    `;

    const banner = document.createElement("div");
    banner.className = "banner";

    const title = document.createElement("div");
    title.textContent = "[M.E.E] 절차 의심 — 형식은 통과인데 과정이 비어 보입니다";
    banner.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = "라벨로는 지워지지 않는 흔적에서 감지됨 (오탐 가능 — 확인용)";
    banner.appendChild(sub);

    const list = document.createElement("ul");
    list.className = "list";
    reasons.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      list.appendChild(li);
    });
    banner.appendChild(list);

    const promptBox = document.createElement("div");
    promptBox.className = "prompt-box";
    promptBox.textContent = PROCESS_PROMPT;
    banner.appendChild(promptBox);

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.type = "button";
    copyBtn.textContent = "📋 절차 확인 프롬프트 복사";
    copyBtn.addEventListener("click", () => {
      const done = () => {
        copyBtn.textContent = "✅ 복사됨";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = "📋 절차 확인 프롬프트 복사";
          copyBtn.classList.remove("copied");
        }, 1800);
      };
      const fail = () => {
        copyBtn.textContent = "복사 실패 — 직접 선택해 복사해줘";
        setTimeout(() => {
          copyBtn.textContent = "📋 절차 확인 프롬프트 복사";
        }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(PROCESS_PROMPT).then(done, fail);
      } else {
        fail();
      }
    });
    banner.appendChild(copyBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => host.remove());
    banner.appendChild(closeBtn);

    shadow.appendChild(style);
    shadow.appendChild(banner);
    setTimeout(() => host.remove(), DEGRADE_BANNER_LIFETIME_MS);
  }

  function showDegradeBanner(reasonText) {
    const host = makeBannerHost(HOST_ID_DEGRADE);

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      .banner {
        pointer-events: auto;
        font-family: -apple-system, "Segoe UI", "Malgun Gothic", "맑은 고딕", sans-serif;
        margin: 12px;
        padding: 14px 40px 14px 16px;
        background: linear-gradient(135deg, #f1c40f, #d4a017);
        color: #3a2e00;
        border-radius: 10px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
        font-size: 13px;
        font-weight: 600;
        line-height: 1.5;
        position: relative;
        max-width: 380px;
        word-break: keep-all;
        animation: spiderEyeSlideIn 0.25s ease-out;
      }
      @keyframes spiderEyeSlideIn {
        from { transform: translateX(24px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .close-btn {
        position: absolute;
        top: 6px;
        right: 8px;
        background: transparent;
        border: none;
        color: #3a2e00;
        font-size: 16px;
        cursor: pointer;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 4px;
      }
      .close-btn:hover {
        background: rgba(0, 0, 0, 0.12);
      }
      .reason {
        font-size: 11px;
        font-weight: 500;
        margin-top: 4px;
        opacity: 0.85;
      }
      .prompt-box {
        margin-top: 10px;
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 6px;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.45;
        max-height: 140px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
        user-select: text;
      }
      .copy-btn {
        margin-top: 8px;
        width: 100%;
        border: none;
        border-radius: 6px;
        padding: 7px 0;
        background: #3a2e00;
        color: #f1c40f;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .copy-btn:hover {
        background: #52420a;
      }
      .copy-btn.copied {
        background: #2ecc71;
        color: #103d20;
      }
    `;

    const banner = document.createElement("div");
    banner.className = "banner";

    const title = document.createElement("div");
    title.textContent =
      "⚠️ 응답 품질 저하 의심 — 형식은 유지되지만 근거가 부실해지고 있습니다";
    banner.appendChild(title);

    if (reasonText) {
      const reason = document.createElement("div");
      reason.className = "reason";
      reason.textContent = reasonText;
      banner.appendChild(reason);
    }

    const promptBox = document.createElement("div");
    promptBox.className = "prompt-box";
    promptBox.textContent = CORRECTION_PROMPT;
    banner.appendChild(promptBox);

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.type = "button";
    copyBtn.textContent = "📋 교정 프롬프트 복사";
    copyBtn.addEventListener("click", () => {
      const done = () => {
        copyBtn.textContent = "✅ 복사됨";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = "📋 교정 프롬프트 복사";
          copyBtn.classList.remove("copied");
        }, 1800);
      };
      const fail = () => {
        copyBtn.textContent = "복사 실패 — 직접 선택해 복사해줘";
        setTimeout(() => {
          copyBtn.textContent = "📋 교정 프롬프트 복사";
        }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(CORRECTION_PROMPT).then(done, fail);
      } else {
        fail();
      }
    });
    banner.appendChild(copyBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.addEventListener("click", () => host.remove());
    banner.appendChild(closeBtn);

    shadow.appendChild(style);
    shadow.appendChild(banner);

    setTimeout(() => {
      if (host.isConnected) host.remove();
    }, DEGRADE_BANNER_LIFETIME_MS);
  }

  function pickCandidateNode(records) {
    // 가장 최근 mutation부터 역순으로 훑어서, 우리 배너가 아닌 첫 후보를 고른다.
    for (let i = records.length - 1; i >= 0; i--) {
      const rec = records[i];
      if (rec.addedNodes && rec.addedNodes.length > 0) {
        const n = rec.addedNodes[rec.addedNodes.length - 1];
        const el = elementOf(n);
        if (el && !isOwnBanner(el)) return n;
      }
      if (rec.target) {
        const el = elementOf(rec.target);
        if (el && !isOwnBanner(el)) return rec.target;
      }
    }
    return null;
  }

  // ---- 열화(degrade) 감지 파서들 ----

  // ⚠️ 버그 수정 [2026-08-16]: 예전에는 "적용:" 뒤 줄 전체를 잡아서 세는 바람에
  //    "적용:①③ / 미적용:②④⑤⑥⑦⑧⑨" 같은 정상 표기에서 미적용 항목까지 적용으로
  //    세어 9개로 집계됐다("연속 9개 전부 적용" 오탐의 원인). "/" 또는 "미적용"이
  //    나오는 지점에서 반드시 잘라야 한다.
  function appliedSegment(text, fieldRe) {
    const m = text.match(fieldRe);
    if (!m) return null;
    let seg = m[1] || "";
    const cut = seg.search(/[\/／]|미적용/);
    return cut === -1 ? seg : seg.slice(0, cut);
  }

  // ⚠️ 관용도 수정 [2026-08-17]: 예전에는 "[9요소]"와 "적용" 사이에 공백(\s*)만
  //    허용해서, 실제 AI들이 흔히 쓰는 '[9요소]: # "적용:①②③..."' 같은 표기를
  //    통째로 못 읽고 null(판단 제외)로 흘려보냈다(Manus/Claude Sonnet 4.5 실제
  //    출력으로 확인). 같은 입력을 HTML 체커는 정상 파싱했는데 확장프로그램만
  //    놓치던 불일치였다. 콜론·따옴표·마크다운 기호가 끼어도 읽도록 완화한다.
  // 필드명은 앞으로 바뀔 수 있다([9요소]가 실제 개수(15)와 어긋난다는 지적이 있음).
  // 지금 바꾸면 배포 문서 전체를 같이 손대야 하므로, **파서만 미리 열어둔다** —
  // [9요소] / [기본9요소] / [15요소] 어느 이름으로 와도 받는다. 나중에 문서에서
  // 이름을 갈아도 이 코드는 안 깨진다.
  const NINE_FIELD_RE = /\[(?:기본)?(?:9|15)요소\][^\n\r]{0,20}?적용\s*[:：]\s*([^\n\r]{0,140})/;
  const EXT_FIELD_RE = /\[확장[36]요소\][^\n\r]{0,20}?적용\s*[:：]\s*([^\n\r]{0,140})/;
  // 확장감각(⑩~⑮)을 [확장6요소] 필드가 아니라 [9요소] 필드에 섞어 쓰는 경우가
  // 실제로 관측된다. 필드 위치는 틀렸어도 "그 감각을 썼다"는 사실은 살려서 센다.
  const NINE_FIELD_ANY_RE = NINE_FIELD_RE;

  // "[9요소]적용:" 뒤에 실제로 적용했다고 적은 ①~⑨ 개수. 태그 없으면 null(판단 제외).
  function countNineElements(text) {
    const seg = appliedSegment(text, NINE_FIELD_RE);
    if (seg === null) return null;
    const circled = seg.match(/[①②③④⑤⑥⑦⑧⑨]/g);
    return circled ? circled.length : 0;
  }

  // 2026-08-16 신설 — 감각 14개(8기본+확장6) 체계 대응.
  // ------------------------------------------------------------------
  // 능동 7개 = ①~⑥ + ⑨(상상기법). ⑦전개도·⑧청사진은 패시브라 카운트 제외.
  // 확장 6감각 = ⑩관찰·⑪순발·⑫예지·⑬주의·⑭신중·⑮추리 (별도 [확장6요소] 필드).
  // 핵심: "①⑤⑦⑧⑨"처럼 5개를 적어도 패시브 2개를 빼면 능동은 3개라 하한 미달이다.
  // 겉보기 개수로 넘어가지 못하게, 능동만 따로 센다.
  const ACTIVE_MARKS_RE = /[①②③④⑤⑥⑨]/g;
  const EXT_MARKS_RE = /[⑩⑪⑫⑬⑭⑮]/g;
  const FLOOR_MIN = 4;

  function countActiveElements(text) {
    const seg = appliedSegment(text, NINE_FIELD_RE);
    if (seg === null) return null;
    const hit = seg.match(ACTIVE_MARKS_RE);
    return hit ? hit.length : 0;
  }

  // 확장 6감각 사용 개수. 상시 강제가 아니라서 없어도 위반은 아니고, 참고용 표시.
  // 정식 위치는 [확장6요소] 필드지만, 실제로는 [9요소] 필드에 ⑩~⑮를 섞어 쓰는
  // 경우가 관측되므로 그쪽도 훑는다 — 필드를 잘못 썼다고 "안 쓴 것"으로 처리하면
  // 실제 사용을 놓친다. 대신 어디서 찾았는지는 misplaced로 구분해 돌려준다.
  //
  // ⚠️ 2026-08-17: ⑭신중함이 패시브로 바뀌었다. 패시브는 "이번에 썼다"가 아니라
  //    "항상 켜져 있다"이므로, 능동적으로 쓴 확장감각과 **같이 세면 안 된다.**
  //    그래서 ⑭는 active 카운트에서 빼고 passiveSeen으로 따로 돌려준다.
  const EXT_PASSIVE_MARK = "⑭";
  function countExtElements(text) {
    const scan = (seg, misplaced) => {
      const hit = seg.match(EXT_MARKS_RE) || [];
      const passiveSeen = hit.includes(EXT_PASSIVE_MARK);
      const active = hit.filter((m) => m !== EXT_PASSIVE_MARK).length;
      return { count: active, passiveSeen, misplaced };
    };
    const proper = appliedSegment(text, EXT_FIELD_RE);
    if (proper !== null) return scan(proper, false);
    const inNine = appliedSegment(text, NINE_FIELD_ANY_RE);
    if (inNine !== null) {
      const r = scan(inNine, true);
      if (r.count || r.passiveSeen) return r;
    }
    return null;
  }

  // 실만증 시각화용 [2026-08-30 신설] — "적용:" 구간에서 실제로 켜진 번호(1~15)를
  // 전부 뽑아낸다. 카운트만 하던 위 함수들과 달리, 팝업에서 그림을 그리려면
  // "몇 개"가 아니라 "어떤 번호들"이 필요하다. [9요소]/[확장6요소] 양쪽 다 훑는다.
  const CIRCLED_CHARS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";
  function extractAppliedNumbers(text) {
    const nums = new Set();
    [NINE_FIELD_RE, EXT_FIELD_RE].forEach((re) => {
      const seg = appliedSegment(text, re);
      if (!seg) return;
      for (const ch of seg) {
        const i = CIRCLED_CHARS.indexOf(ch);
        if (i !== -1) nums.add(i + 1);
      }
    });
    return [...nums].sort((a, b) => a - b);
  }

  function saveLatestMeeState(text) {
    const aiMatch = text.match(/\[(?:만증|거증)\]\s*AI\s*:\s*([^\n\r]+)/);
    const repeatMatch = text.match(/\[반복법\]\s*(\d+)\s*회/);
    const appliedNumbers = extractAppliedNumbers(text);
    if (!appliedNumbers.length && !aiMatch) return; // [만증] 흔적 자체가 없으면 저장 안 함(빈 그림 방지)
    const activeCount = appliedNumbers.filter((n) => [1,2,3,4,5,6,9].includes(n)).length;
    const state = {
      ai: aiMatch ? aiMatch[1].trim() : "미상",
      repeat: repeatMatch ? Number(repeatMatch[1]) : null,
      appliedNumbers,
      activeCount,
      floorOk: activeCount >= FLOOR_MIN,
      ts: Date.now()
    };
    try {
      chrome.storage.local.set({ ["spiderLatest:" + ORIGIN]: state });
    } catch (e) { /* 저장 실패해도 감시 자체는 계속 진행 */ }
  }

  // 하한 미달인데 ⚠️[하한미달] 신고조차 없으면 true(=조용히 넘어감 = 드리프트).
  // 신고했으면 정직하게 밝힌 것이므로 false.
  function isFloorBreached(text) {
    const n = countActiveElements(text);
    if (n === null) return null; // 태그 없음 → 판단 제외
    if (n >= FLOOR_MIN) return false;
    const declared = /⚠?\s*\[하한미달\]/.test(text);
    return !declared;
  }

  const CONCRETE_EVIDENCE_RE =
    /(파일|파일명|\.js|\.py|\.html|\.css|\.json|\.md|\.ts|\.tsx|함수|변수|줄\s*\d+|line\s*\d+|스크린샷|screenshot|커밋|commit|코드|스크립트|경로|폴더|디렉터리|[0-9]+\s*(개|건|줄|%|번|회))/i;

  const RHETORICAL_RE =
    /(판단됩니다|판단됨|느껴집니다|느껴짐|추측됩니다|추측됨|성찰|뼈저리게|오만함|부끄럽습니다|반성합니다|죄송합니다|아쉽습니다|생각됩니다|것\s*같습니다|마음가짐|다짐하겠습니다)/g;

  // "[검증]확인함:" 뒤 텍스트에 구체적 근거가 전혀 없이 감정적/수사적 어휘만
  // 있으면 true(근거 부족). 태그 자체가 없으면 null(이 메시지는 판단 제외).
  function isEvidenceWeak(text) {
    const m = text.match(/\[검증\]\s*확인함\s*[:：]\s*([^\n\r]{0,300})/);
    if (!m) return null;
    const segment = m[1];
    const hasConcrete = CONCRETE_EVIDENCE_RE.test(segment);
    const rhetoricalMatches = segment.match(RHETORICAL_RE);
    const hasRhetorical = !!rhetoricalMatches && rhetoricalMatches.length >= 1;
    return !hasConcrete && hasRhetorical;
  }

  // ==================================================================
  // 절차 신호 3종 (2026-08-17 신설) — 라벨로는 지워지지 않는 흔적만 본다
  // ==================================================================

  // ① 승인 요청(= 훈련 1단계)을 했는가.
  //    1단계를 실제로 밟으면 반드시 "이거 맞습니까?" 류로 대화가 끊긴다.
  const APPROVAL_RE =
    /(1\s*단계\s*(한\s*줄)?|죽\s*(단계|한\s*줄)|승인|허락|이대로\s*(갈까|할까|괜찮)|맞습니까|맞나요|괜찮(을까요|습니까|나요)|해도\s*될까요|진행할까요|어떻게\s*(생각|보시)|말씀해\s*주십시오|정해주시면|알려주시면)/;
  function askedApproval(text) {
    return APPROVAL_RE.test(text);
  }

  // ② 사후 발견 — "다시 보니 놓쳤다" 류. 자진 신고 자체는 정직하지만,
  //    잦다는 건 **작업 당시에 안 봤다**는 뜻이므로 절차 미실행 신호다.
  const POSTHOC_RE =
    /(놓쳤|빠뜨렸|누락(했|됐|되어)|안\s*고쳤|다시\s*보니|확인해\s*보니|살펴보니|알고\s*보니|제\s*진단이\s*틀|잘못\s*(봤|읽|판단)|오탐|되돌아보니)/g;
  function countPostHoc(text) {
    const m = text.match(POSTHOC_RE);
    return m ? m.length : 0;
  }

  // ③ 산출물 규모 — 단계를 밟았다면 한 턴에 이만큼 못 낸다.
  //    코드블록 수 + 파일/문서 언급 수로 대략 잰다(정확할 필요 없음, 규모 감만).
  function measureOutputScale(text) {
    const codeBlocks = (text.match(/```/g) || []).length / 2;
    const fileHits = (text.match(/[\w가-힣()_.-]+\.(md|js|html|py|json|txt|vbs|css)/g) || []).length;
    return Math.round(codeBlocks * 2 + fileHits);
  }

  // 되돌리기 어려운 작업인가 — ⑭신중함 패시브의 보고 의무가 걸리는 구간.
  const RISKY_EDIT_RE =
    /(덮어쓰|삭제|지웠|지울|일괄\s*(수정|변경|적용)|전수\s*(수정|반영)|이동시켰|옮겼|rename|mv\s|rm\s|전송|배포|커밋|push)/;
  function isRiskyEdit(text) {
    return RISKY_EDIT_RE.test(text);
  }

  // ⑭신중함 패시브 보고 — 되돌리기 어려운 작업이면 "무엇을 점검했는지" 한 줄이 있어야 한다.
  const PASSIVE_REPORT_RE = /(\[신중함\]|⚙️|점검\s*[:：]|사전\s*점검|되돌(릴|리기)\s*방법)/;
  function hasPassiveReport(text) {
    return PASSIVE_REPORT_RE.test(text);
  }

  function pushHistory(arr, value) {
    arr.push(value);
    while (arr.length > HISTORY_KEEP) arr.shift();
  }

  function lastNAllEqual(arr, n, value) {
    if (arr.length < n) return false;
    const tail = arr.slice(-n);
    return tail.every((v) => v === value);
  }

  // ==================================================================
  // 절차 판정 (2026-08-17 신설) — 형식 판정과 **분리해서** 본다
  // ------------------------------------------------------------------
  // 형식(라벨·개수·태그)은 통과인데 절차(1단계·마찰·승인)는 비어 있는 상태가
  // 실제로 존재한다. 그래서 "정상/비정상" 한 축으로 뭉뚱그리지 않고 따로 띄운다.
  // 오탐이 있을 수 있으므로 **차단이 아니라 '의심' 표시**로만 쓴다.
  // ==================================================================
  const NO_FRICTION_TURNS = 5; // 이 턴 수 연속으로 승인 요청이 0회면 의심
  const POSTHOC_THRESHOLD = 3; // 최근 이력에서 사후 발견이 이만큼 쌓이면 의심
  const BIG_OUTPUT_SCALE = 6; // 이 이상이면 "대량 산출물"로 본다

  function judgeProcess() {
    const suspicions = [];
    if (turnHistory.length < 2) return suspicions; // 이력이 얕으면 판정 안 함

    // ③ 마찰 없음 — 1단계를 밟으면 승인 요청으로 대화가 끊긴다. 안 끊겼다는 건 안 멈췄다는 뜻.
    const recent = turnHistory.slice(-NO_FRICTION_TURNS);
    if (
      recent.length >= NO_FRICTION_TURNS &&
      recent.every((t) => !t.askedApproval)
    ) {
      suspicions.push(
        `최근 ${NO_FRICTION_TURNS}턴 연속 승인 요청 0회 — 훈련 1단계를 한 번도 안 밟았을 가능성`
      );
    }

    // ① 사후 발견 — 나중에 찾아낸 실수가 쌓이면, 그때 안 봤다는 뜻.
    const posthocTotal = turnHistory.reduce((a, t) => a + t.postHocHits, 0);
    if (posthocTotal >= POSTHOC_THRESHOLD) {
      suspicions.push(
        `사후 발견 표현 누적 ${posthocTotal}회 — 작업 당시 확인을 안 하고 나중에 찾아내는 패턴`
      );
    }

    // ② 속도 — 대량 산출물이 나왔는데 직전 턴에 승인 요청이 없었으면 절차 생략.
    const last = turnHistory[turnHistory.length - 1];
    const prev = turnHistory[turnHistory.length - 2];
    if (last.outputScale >= BIG_OUTPUT_SCALE && prev && !prev.askedApproval && !last.askedApproval) {
      suspicions.push(
        `대량 산출물(규모 ${last.outputScale})인데 직전에 승인 요청 없음 — 1단계 생략 의심`
      );
    }

    // ⑭신중함 패시브 보고 — 되돌리기 어려운 작업이면 "무엇을 점검했는지" 한 줄이 있어야 한다.
    if (last.riskyEdit && !last.passiveReported) {
      suspicions.push(
        `되돌리기 어려운 작업인데 ⑭신중함 점검 보고 없음 (덮어쓰기·삭제·일괄수정 등)`
      );
    }

    return suspicions;
  }

  function checkDegradation(text) {
    const nineCount = countNineElements(text);
    if (nineCount !== null) pushHistory(nineElementHistory, nineCount);

    const weak = isEvidenceWeak(text);
    if (weak !== null) pushHistory(evidenceWeakHistory, weak);

    // 2026-08-16 신설: 능동 4개 하한 미달을 신고 없이 넘어가는지 추적.
    const breached = isFloorBreached(text);
    if (breached !== null) pushHistory(floorBreachHistory, breached);

    const nineAllZero = lastNAllEqual(
      nineElementHistory,
      CONSECUTIVE_THRESHOLD,
      0
    );
    const nineAllFull = lastNAllEqual(
      nineElementHistory,
      CONSECUTIVE_THRESHOLD,
      9
    );
    const evidenceAllWeak = lastNAllEqual(
      evidenceWeakHistory,
      CONSECUTIVE_THRESHOLD,
      true
    );
    // 2026-08-16 신설: 하한 미달은 "연속"을 기다리지 않고 1회만 나와도 바로 경고한다.
    // 다른 항목(0개/9개 반복)은 패턴을 봐야 판단되지만, 하한 미달+무신고는
    // 그 자체로 이미 규칙 위반이라 유예를 둘 이유가 없다.
    const floorBreachedNow =
      floorBreachHistory.length > 0 &&
      floorBreachHistory[floorBreachHistory.length - 1] === true;

    if (nineAllZero || nineAllFull || evidenceAllWeak || floorBreachedNow) {
      const reasons = [];
      if (floorBreachedNow)
        reasons.push(
          "능동 4개 하한 미달인데 ⚠️[하한미달] 신고 없음 (⑦전개도·⑧청사진은 패시브라 카운트 제외)"
        );
      if (nineAllZero)
        reasons.push(
          `최근 ${CONSECUTIVE_THRESHOLD}개 메시지 연속 [9요소] 0개(전부 미적용)`
        );
      if (nineAllFull)
        reasons.push(
          `최근 ${CONSECUTIVE_THRESHOLD}개 메시지 연속 [9요소] 9개 전부 적용`
        );
      if (evidenceAllWeak)
        reasons.push(
          `최근 ${CONSECUTIVE_THRESHOLD}개 메시지 연속 [검증] 근거 부족(수사적 표현만)`
        );
      showDegradeBanner(reasons.join(" / "));
      return reasons; // 2026-08-17: 자동재요청이 "이번 턴에 위반이 있었는지" 판단하는 데 씀
    }
    return [];
  }

  function checkLatestMessage() {
    const records = pendingRecords;
    pendingRecords = [];

    if (!enabled) return;
    if (records.length === 0) return;

    const candidateNode = pickCandidateNode(records);
    if (!candidateNode) return;

    const el = elementOf(candidateNode);
    if (isUserInputArea(el)) return; // 사용자 입력창 자체는 검사 대상 제외

    const text = findBubbleText(candidateNode);
    if (!text || text.length < MIN_TEXT_LEN) return;

    if (!baselineRecorded) {
      // 스크립트 주입 직후 첫 안정화 = 이미 있던 페이지 내용일 수 있으므로
      // 경고 없이 기준선으로만 기록한다(오탐 방지).
      baselineRecorded = true;
      lastCheckedText = text;
      // [2026-08-30] 단, 시각화는 "위반 감시"가 아니라 "지금 화면에 뭐가
      // 떠 있는가"를 보여주는 것뿐이라 기준선이어도 저장한다 — 안 그러면
      // 확장을 새로고침한 직후 이미 떠 있던 [만증] 메시지를 영원히 못 읽는다.
      saveLatestMeeState(text);
      return;
    }

    if (text === lastCheckedText) return; // 같은 메시지 중복 검사 방지
    lastCheckedText = text;

    // [2026-08-17] 실제로 새 메시지 하나를 처리하는 시점 — 턴 카운터 증가.
    totalTurnCount++;
    updateTurnCounterBadge();

    const hasBanTag = /\[(?:만반|거반)\]/.test(text);
    const hasJeungTag = /\[(?:만증|거증)\]/.test(text);

    saveLatestMeeState(text); // [2026-08-30] 팝업 실만증 시각화용 — 추측 없이 있는 그대로 저장

    let violatedThisTurn = false;

    // 기존 로직: 태그 자체가 없으면 "누락" 배너 (그대로 유지).
    if (!(hasBanTag && hasJeungTag)) {
      showBanner();
      violatedThisTurn = true;
      attemptAutoResend(TAG_MISSING_RESEND_PROMPT, "태그누락");
    }

    // 신규 로직: 태그 유무와 독립적으로 항상 열화 신호를 관찰한다. 태그가
    // 있어도 내용이 부실해지는 패턴을 잡는 것이 목적이므로, 누락 배너가
    // 떴는지 여부와 상관없이 이력을 갱신하고 필요하면 별도 배너를 띄운다.
    const degradeReasons = checkDegradation(text);
    if (degradeReasons && degradeReasons.length) {
      violatedThisTurn = true;
      attemptAutoResend(CORRECTION_PROMPT, "품질저하");
      logCollapseOnce("열화"); // [2026-08-17] 이번 세션 첫 붕괴 시점 기록
    }

    // ---- 절차 감시 [2026-08-17 신설] ----
    // 형식(위 checkDegradation)과 분리해서, 턴 흐름에 남은 흔적만 본다.
    const ext = countExtElements(text);
    pushTurn({
      askedApproval: askedApproval(text),
      outputScale: measureOutputScale(text),
      postHocHits: countPostHoc(text),
      hasTags: hasBanTag && hasJeungTag,
      activeCount: countActiveElements(text),
      extActive: ext ? ext.count : 0,
      extPassiveSeen: ext ? ext.passiveSeen : false,
      riskyEdit: isRiskyEdit(text),
      passiveReported: hasPassiveReport(text),
      ts: Date.now()
    });

    const procSuspicions = judgeProcess();
    if (procSuspicions.length) {
      showProcessBanner(procSuspicions);
      violatedThisTurn = true;
      attemptAutoResend(PROCESS_PROMPT, "절차의심");
      logCollapseOnce("절차의심"); // [2026-08-17] 열화와 별개 트리거 — 먼저 울린 쪽만 기록됨(collapseLoggedThisSession 가드)
    }

    resetAutoResendStreakIfClean(violatedThisTurn);
  }

  function onMutations(mutations) {
    if (!enabled) return;
    pendingRecords.push(...mutations);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkLatestMessage, DEBOUNCE_MS);
  }

  // ==================================================================
  // 팝업이 세션 상태를 물어보면 응답한다 [2026-08-17 신설]
  // ------------------------------------------------------------------
  // 팝업에는 켜고 끄는 스위치만 있었고, 감시가 무엇을 보고 있는지 전혀 안
  // 보였다. 형식은 통과인데 절차가 비어 있는 상태를 사용자가 직접 확인할 수
  // 있어야 하므로, 현재 세션 요약을 넘겨준다.
  // ==================================================================
  function buildSessionSummary() {
    const turns = turnHistory.length;
    const approvals = turnHistory.filter((t) => t.askedApproval).length;
    const postHoc = turnHistory.reduce((a, t) => a + t.postHocHits, 0);
    const tagMissing = turnHistory.filter((t) => !t.hasTags).length;
    const floorBad = floorBreachHistory.filter(Boolean).length;
    return {
      turns,
      approvals,
      postHoc,
      tagMissing,
      floorBad,
      // 형식 축: 태그 누락이나 하한 위반이 있으면 문제
      formatOk: tagMissing === 0 && floorBad === 0,
      // 절차 축: judgeProcess가 아무것도 못 잡으면 통과
      suspicions: judgeProcess()
    };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "MEE_SESSION_STATE") {
      sendResponse(buildSessionSummary());
      return true;
    }
    return undefined;
  });

  const observer = new MutationObserver(onMutations);

  function startObserving() {
    if (!document.body) {
      // 아주 드물게 document_idle에도 body가 없으면 잠깐 뒤 재시도
      setTimeout(startObserving, 200);
      return;
    }
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    console.log("[정직성체커] 실시간 감시 시작:", location.hostname);
  }

  function applyEnabledState(value) {
    enabled = value !== false; // 기본값 true
    console.log("[정직성체커] 실시간 감시", enabled ? "켜짐" : "꺼짐");
  }

  try {
    chrome.storage.local.get({ monitorEnabled: true }, (res) => {
      applyEnabledState(res.monitorEnabled);
      startObserving();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && "monitorEnabled" in changes) {
        applyEnabledState(changes.monitorEnabled.newValue);
      }
    });
  } catch (e) {
    // storage 접근이 어떤 이유로든 실패하면 기본값(켜짐)으로 동작
    console.error("[정직성체커] storage 접근 실패, 기본값으로 동작:", e);
    startObserving();
  }
})();
