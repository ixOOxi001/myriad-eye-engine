// 만안엔진 정직성체커 — 부스터 인젝션 (무료 모델 세션 전용)
//
// 배경: 무료 티어 AI는 대화가 길어질수록("중반부") 시스템 레벨 리소스 관리
// 개입(컨텍스트 압축, 경량 모델 전환 등)이 잦고, 이게 "만안엔진 프레임워크를
// 계속 유지하라"는 지시와 충돌하면서 판단력이 무너지는 현상이 있다. 이 스크립트는
// "이 세션은 무료 모델임" 토글이 켜진 탭에서, 설정된 주기마다 짧은 재주입(부스터)
// 프롬프트를 채팅 입력창에 채우고 전송해서 프레임워크를 주기적으로 "리프레시"한다.
//
// 안전 최우선 원칙 (반드시 지킬 것):
// - 사이트별 전용 셀렉터를 쓰지 않는다. 범용 휴리스티콕만 사용하고, 후보가
//   애매하면(여러 개 발견 등) 절대 진행하지 않고 조용히 건너뛴다.
// - 사용자가 방금 입력 중이었거나, 입력창에 이미 텍스트가 있으면 건너뛴다.
// - 전송 버튼을 확신 있게 찾으면 클릭, 아니면 Enter 키 이벤트로 대체 전송한다.
//   (Enter 디스패치는 스펙상 허용된 "차선책"이며 여기서 "불확실하니 아예
//   전송하지 않기"에 해당하는 것은 아니다 — 입력창 탐지 자체가 불확실할 때만
//   전체 동작을 건너뛴다.)

(function () {
  if (window.__meeBoosterInjected) return;
  window.__meeBoosterInjected = true;

  const ORIGIN = location.origin;
  const FREE_MODEL_KEY = "freeModel:" + ORIGIN;
  const INTERVAL_KEY = "boosterIntervalMinutes";
  const DEFAULT_INTERVAL_MIN = 10;

  const RECENT_INPUT_GUARD_MS = 6000; // 최근 N초 안에 사용자가 입력창을 만졌으면 이번 주기는 건너뜀
  const TOAST_LIFETIME_MS = 4000;

  // 2026-08-17 확장: 이 부스터가 곧 "재각인"의 실시간 버전이다. 문서 말미의 재각인
  // 블록은 세션 시작 때 한 번 읽히고 끝이지만, 드리프트는 대화 중반에 생긴다.
  // 그래서 주기 재주입 문구에 "하한선"을 반드시 실어야 한다 — 이게 빠지면
  // "9요소 지켜라"는 말만 반복되고, 정작 몇 개를 켜야 하는지가 없어서
  // 5개→3개→0개로 조용히 줄어드는 걸 막지 못한다.
  const BOOSTER_PROMPT =
    "[M.E.E] 리마인드: 지금부터도 계속 [거반][거증]+만안엔진 15요소(9요소+확장6요소)+훈련 4단계로만 " +
    "작동해라. 일반 사고 프로세서로 새지 마라.\n" +
    "· 능동 7개(①~⑥+⑨) 중 4개는 권장이 아니라 하한선이다. ⑦전개도·⑧청사진은 패시브라 이 카운트에서 빠진다 " +
    "— 5개를 적어도 그중 ⑦⑧이 있으면 능동은 3개다.\n" +
    "· 4개 미만으로 답할 거면 ⚠️[하한미달] 능동 N개 — 사유:(구체적 이유) 를 반드시 붙여라. " +
    '"간단해서"는 사유가 아니다.\n' +
    "· 확장6요소(⑩관찰·⑪순발·⑫예지·⑬주의·⑭신중·⑮추리)는 [9요소] 필드에 섞지 말고 [확장6요소] 필드에 따로 적어라.\n" +
    '· "방금 좀 놓쳤지만 다음 턴부터 잘하면 되겠지" — 이 생각이 들면 그 자리가 이미 드리프트 시작점이다.';

  let freeModelEnabled = false;
  let intervalMinutes = DEFAULT_INTERVAL_MIN;
  let timerHandle = null;
  let lastUserActivityAt = 0;

  // ---- 사용자가 입력창을 직접 만지고 있는지 추적 ----
  function isInputLike(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(
      'textarea, input, [contenteditable="true"], [contenteditable=""], [role="textbox"]'
    );
  }

  function markActivity(e) {
    if (isInputLike(e.target)) {
      lastUserActivityAt = Date.now();
    }
  }

  document.addEventListener("input", markActivity, true);
  document.addEventListener("keydown", markActivity, true);
  document.addEventListener("focus", markActivity, true);

  // ---- 채팅 입력창 탐지 (범용 휴리스틱) ----
  function findChatInputCandidate() {
    const selector =
      'textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]';
    const all = Array.from(document.querySelectorAll(selector));
    const viewportH = window.innerHeight || document.documentElement.clientHeight;

    const scored = [];
    for (const el of all) {
      if (el.disabled || el.readOnly) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (parseFloat(style.opacity || "1") === 0) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 16) continue; // 너무 작은 요소(아이콘 버튼 등) 제외
      if (rect.bottom < viewportH * 0.25) continue; // 화면 상단 쪽은 채팅 입력창일 가능성 낮음
      if (rect.top > viewportH || rect.bottom < 0) continue; // 화면 밖(스크롤로 안 보임)이면 제외

      // 하단에 가까울수록 + 넓을수록 점수 상승 (채팅 입력창 전형적 위치/모양)
      const score = rect.bottom + rect.width * 0.15;
      scored.push({ el, rect, score });
    }

    if (scored.length === 0) return null;
    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 1) return scored[0].el;

    // 1등과 2등의 점수 차이가 충분히 크지 않으면 "애매함"으로 보고 아예 건너뛴다.
    const top = scored[0];
    const second = scored[1];
    const gap = top.score - second.score;
    const requiredGap = Math.max(top.score * 0.12, 60);
    if (gap < requiredGap) return null;

    return top.el;
  }

  function getElementText(el) {
    if (el.tagName === "TEXTAREA") return el.value || "";
    return el.textContent || "";
  }

  function isElementEmpty(el) {
    return getElementText(el).trim().length === 0;
  }

  // ---- 값 채우기 (React 등 프레임워크 대응: 네이티브 setter + 이벤트 디스패치) ----
  function setTextareaValue(el, text) {
    const proto = window.HTMLTextAreaElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) {
      desc.set.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setContentEditableValue(el, text) {
    el.focus();
    el.textContent = text;
    try {
      el.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: text })
      );
    } catch (e) {
      // InputEvent 생성자가 막힌 환경 대비 폴백
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillInput(el, text) {
    if (el.tagName === "TEXTAREA") {
      setTextareaValue(el, text);
    } else {
      setContentEditableValue(el, text);
    }
  }

  // ---- 전송 버튼 탐색 (확신 있을 때만 클릭, 아니면 Enter로 대체) ----
  const SEND_WORD_RE = /(send|전송|submit|보내기)/i;

  function looksLikeSendButton(btn) {
    if (!btn) return false;
    const aria = (btn.getAttribute("aria-label") || "").trim();
    const title = (btn.getAttribute("title") || "").trim();
    const text = (btn.textContent || "").trim();
    const type = (btn.getAttribute("type") || "").trim();
    if (type === "submit") return true;
    if (SEND_WORD_RE.test(aria)) return true;
    if (SEND_WORD_RE.test(title)) return true;
    if (text && SEND_WORD_RE.test(text)) return true;
    return false;
  }

  function findSendButton(inputEl) {
    // 입력창을 포함하는 form이 있으면 그 안에서만 탐색 (범위를 좁혀 오탐 방지)
    const form = inputEl.closest ? inputEl.closest("form") : null;
    let scope = form;

    if (!scope) {
      // form이 없으면 부모를 몇 단계 타고 올라가며 가장 가까운 "그럴듯한 컨테이너"를 스코프로 삼는다.
      let el = inputEl.parentElement;
      let hops = 0;
      while (el && hops < 5) {
        if (el.querySelector("button, [role='button']")) {
          scope = el;
          break;
        }
        el = el.parentElement;
        hops++;
      }
    }
    if (!scope) return null;

    const buttons = Array.from(scope.querySelectorAll("button, [role='button']"));
    const candidates = buttons.filter(looksLikeSendButton);

    if (candidates.length === 1) return candidates[0];
    return null; // 0개 또는 여러 개 → 확신 없음
  }

  function dispatchEnter(el) {
    const opts = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  // ---- 작은 토스트 알림 (Shadow DOM, monitor.js 배너와 겹치지 않게 좌하단 배치) ----
  function showToast(message) {
    const hostId = "mee-booster-toast-host";
    const existing = document.getElementById(hostId);
    if (existing) existing.remove();

    const host = document.createElement("div");
    host.id = hostId;
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.left = "0";
    host.style.bottom = "0";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      .toast {
        font-family: -apple-system, "Segoe UI", "Malgun Gothic", "맑은 고딕", sans-serif;
        margin: 12px;
        padding: 10px 14px;
        background: linear-gradient(135deg, #6c5ce7, #4834d4);
        color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        font-size: 12px;
        font-weight: 600;
        line-height: 1.4;
        max-width: 260px;
        word-break: keep-all;
        animation: meeToastIn 0.2s ease-out;
      }
      @keyframes meeToastIn {
        from { transform: translateY(10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    shadow.appendChild(style);
    shadow.appendChild(toast);

    setTimeout(() => {
      if (host.isConnected) host.remove();
    }, TOAST_LIFETIME_MS);
  }

  function formatNowHHMM() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  }

  // ---- 인젝션 실행 (한 사이클) ----
  function runBoosterCycle() {
    if (!freeModelEnabled) return;

    // 안전장치 1: 최근에 사용자가 입력창을 직접 만졌으면 이번 주기는 건너뛴다.
    if (Date.now() - lastUserActivityAt < RECENT_INPUT_GUARD_MS) {
      console.log("[정직성체커/부스터] 사용자 입력 감지 직후 — 이번 주기 건너뜀");
      return;
    }

    const inputEl = findChatInputCandidate();
    if (!inputEl) {
      console.log("[정직성체커/부스터] 입력창 후보 불확실 — 건너뜀");
      return;
    }

    // 안전장치 2: 입력창이 이미 비어있지 않으면(사용자가 뭔가 써놓은 상태) 건너뛴다.
    if (!isElementEmpty(inputEl)) {
      console.log("[정직성체커/부스터] 입력창에 기존 내용 있음 — 건너뜀");
      return;
    }

    fillInput(inputEl, BOOSTER_PROMPT);

    // 전송 버튼을 확신 있게 찾으면 클릭, 아니면 Enter 키로 대체 전송.
    // (둘 중 하나는 항상 시도한다 — "채우기까지만"은 입력창 탐지 자체가
    // 불확실할 때만 해당되며, 이미 위에서 그 경우는 걸러졌다.)
    const sendBtn = findSendButton(inputEl);
    if (sendBtn) {
      sendBtn.click();
      console.log("[정직성체커/부스터] 전송 버튼 클릭으로 인젝션 완료");
    } else {
      dispatchEnter(inputEl);
      console.log("[정직성체커/부스터] Enter 키 디스패치로 인젝션 완료");
    }

    showToast("[M.E.E] 부스터 인젝션 전송됨 (" + formatNowHHMM() + ")");
  }

  // ---- 타이머 관리 ----
  function stopTimer() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
  }

  function startTimer() {
    stopTimer();
    if (!freeModelEnabled) return;
    const ms = Math.max(1, intervalMinutes) * 60 * 1000;
    timerHandle = setInterval(runBoosterCycle, ms);
    console.log(
      "[정직성체커/부스터] 타이머 시작 — 주기:",
      intervalMinutes,
      "분 (탭이 열려있는 동안만 유지)"
    );
  }

  function applyState(next) {
    const changedFreeModel = next.freeModelEnabled !== freeModelEnabled;
    const changedInterval = next.intervalMinutes !== intervalMinutes;
    freeModelEnabled = next.freeModelEnabled;
    intervalMinutes = next.intervalMinutes;

    if (changedFreeModel || changedInterval) {
      if (freeModelEnabled) {
        startTimer();
      } else {
        stopTimer();
      }
    }
  }

  function loadStateAndInit() {
    const query = {};
    query[FREE_MODEL_KEY] = true;
    query[INTERVAL_KEY] = DEFAULT_INTERVAL_MIN;

    chrome.storage.local.get(query, (res) => {
      applyState({
        freeModelEnabled: !!res[FREE_MODEL_KEY],
        intervalMinutes: Number(res[INTERVAL_KEY]) || DEFAULT_INTERVAL_MIN,
      });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      const next = { freeModelEnabled, intervalMinutes };
      let touched = false;
      if (FREE_MODEL_KEY in changes) {
        next.freeModelEnabled = !!changes[FREE_MODEL_KEY].newValue;
        touched = true;
      }
      if (INTERVAL_KEY in changes) {
        next.intervalMinutes = Number(changes[INTERVAL_KEY].newValue) || DEFAULT_INTERVAL_MIN;
        touched = true;
      }
      if (touched) applyState(next);
    });
  }

  try {
    loadStateAndInit();
  } catch (e) {
    console.error("[정직성체커/부스터] 초기화 실패:", e);
  }
})();
