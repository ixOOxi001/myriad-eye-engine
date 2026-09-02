const toggle = document.getElementById("monitorToggle");
const sendBtn = document.getElementById("sendBtn");
const statusEl = document.getElementById("status");
const freeModelToggle = document.getElementById("freeModelToggle");
const boosterIntervalInput = document.getElementById("boosterInterval");
const adminStatusEl = document.getElementById("adminStatus");

const DEFAULT_BOOSTER_INTERVAL_MIN = 10;

// 저장된 감시 on/off 상태 불러오기 (기본값: 켜짐)
chrome.storage.local.get({ monitorEnabled: true }, (res) => {
  toggle.checked = res.monitorEnabled !== false;
});

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ monitorEnabled: toggle.checked });
  statusEl.textContent = toggle.checked
    ? "실시간 감시를 켰습니다."
    : "실시간 감시를 껐습니다.";
});

// ---- 무료 모델 세션 토글: 탭(origin)별로 저장 ----
// 부스터 인젝션은 유료 세션에 불필요하게 끼어들지 않도록, 현재 활성 탭의
// origin 단위로만 켜고 끈다. 다른 origin 탭에는 영향을 주지 않는다.
function currentTabOrigin(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.url) {
      callback(null);
      return;
    }
    try {
      callback(new URL(tab.url).origin);
    } catch (e) {
      callback(null);
    }
  });
}

function freeModelKeyFor(origin) {
  return "freeModel:" + origin;
}

currentTabOrigin((origin) => {
  if (!origin) {
    freeModelToggle.disabled = true;
    return;
  }
  const key = freeModelKeyFor(origin);
  const query = {};
  query[key] = true;
  chrome.storage.local.get(query, (res) => {
    freeModelToggle.checked = !!res[key];
  });

  freeModelToggle.addEventListener("change", () => {
    const value = {};
    value[key] = freeModelToggle.checked;
    chrome.storage.local.set(value);
    statusEl.textContent = freeModelToggle.checked
      ? "이 사이트를 무료 모델 세션으로 설정 — 부스터 인젝션 작동."
      : "무료 모델 세션 해제 — 부스터 인젝션 중지.";
  });
});

// ---- 자동 재요청 토글: 탭(origin)별로 저장 [2026-08-17 신설] ----
const autoResendToggle = document.getElementById("autoResendToggle");
function autoResendKeyFor(origin) {
  return "autoResend:" + origin;
}
currentTabOrigin((origin) => {
  if (!origin) {
    autoResendToggle.disabled = true;
    return;
  }
  const key = autoResendKeyFor(origin);
  const query = {};
  query[key] = false;
  chrome.storage.local.get(query, (res) => {
    autoResendToggle.checked = !!res[key];
  });

  autoResendToggle.addEventListener("change", () => {
    const value = {};
    value[key] = autoResendToggle.checked;
    chrome.storage.local.set(value);
    statusEl.textContent = autoResendToggle.checked
      ? "이 사이트에서 위반 감지 시 자동 재요청 켬."
      : "자동 재요청 껐음 — 배너의 복사 버튼으로 수동 전송해야 함.";
  });
});

// ---- 관리자 메뉴: 부스터 인젝션 주기(분) ----
chrome.storage.local.get(
  { boosterIntervalMinutes: DEFAULT_BOOSTER_INTERVAL_MIN },
  (res) => {
    const val = Number(res.boosterIntervalMinutes) || DEFAULT_BOOSTER_INTERVAL_MIN;
    boosterIntervalInput.value = val;
  }
);

boosterIntervalInput.addEventListener("change", () => {
  let val = parseInt(boosterIntervalInput.value, 10);
  if (!Number.isFinite(val) || val < 1) {
    val = DEFAULT_BOOSTER_INTERVAL_MIN;
    boosterIntervalInput.value = val;
  }
  chrome.storage.local.set({ boosterIntervalMinutes: val });
  adminStatusEl.textContent = "부스터 주기를 " + val + "분으로 저장했습니다.";
});

// ==================================================================
// 세션 상태판 [2026-08-17 신설]
// ------------------------------------------------------------------
// monitor.js가 쌓아둔 턴 이력을 받아와서, 형식과 절차를 **따로** 보여준다.
// 오늘 확인된 문제가 정확히 "형식은 통과인데 절차가 비어 있는 상태"라서,
// 한 줄로 뭉뚱그리면 그 구간이 안 보인다.
// ==================================================================
function renderSessionState() {
  const fmtEl = document.getElementById("statFormat");
  const procEl = document.getElementById("statProcess");
  const turnsEl = document.getElementById("statTurns");
  const postHocEl = document.getElementById("statPostHoc");
  const listEl = document.getElementById("suspList");
  if (!fmtEl) return;

  const setUnavailable = (why) => {
    [fmtEl, procEl, turnsEl, postHocEl].forEach((el) => {
      el.textContent = "—";
      el.className = "stat-val";
    });
    listEl.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = why;
    listEl.appendChild(li);
  };

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      setUnavailable("활성 탭을 찾지 못했습니다.");
      return;
    }
    chrome.tabs.sendMessage(
      tab.id,
      { type: "MEE_SESSION_STATE" },
      (res) => {
        if (chrome.runtime.lastError || !res) {
          // 감시 스크립트가 주입되지 않은 페이지(설정창, 새 탭 등) — 또는
          // 확장을 방금 새로고침했는데 이 탭은 그 전에 열려있던 경우.
          // [2026-08-30] 이유 없이 "작동 안 함"만 뜨면 보는 사람이 "이거 코딩을
          // 제대로 한 거야?"로 오해하니, 원인과 해결법을 바로 알려준다.
          setUnavailable("이 탭에서는 감시가 작동하지 않습니다. (지원 사이트가 아니거나, 방금 확장을 새로고침했다면 이 채팅창 탭도 F5로 새로고침해주세요)");
          return;
        }
        fmtEl.textContent = res.formatOk
          ? "통과"
          : `문제 (태그누락 ${res.tagMissing} / 하한위반 ${res.floorBad})`;
        fmtEl.className = "stat-val " + (res.formatOk ? "ok" : "bad");

        const procOk = res.suspicions.length === 0;
        procEl.textContent = procOk ? "통과" : `의심 ${res.suspicions.length}건`;
        procEl.className = "stat-val " + (procOk ? "ok" : "warn");

        turnsEl.textContent = `${res.turns}턴 / ${res.approvals}회`;
        turnsEl.className =
          "stat-val " + (res.turns >= 3 && res.approvals === 0 ? "warn" : "");

        postHocEl.textContent = `${res.postHoc}회`;
        postHocEl.className = "stat-val " + (res.postHoc >= 3 ? "warn" : "");

        listEl.innerHTML = "";
        res.suspicions.forEach((s) => {
          const li = document.createElement("li");
          li.textContent = s;
          listEl.appendChild(li);
        });
      }
    );
  });
}

renderSessionState();

// ==================================================================
// 실만증 시각화 [2026-08-30 신설]
// ------------------------------------------------------------------
// monitor.js가 페이지의 실제 AI 응답에서 자동으로 뽑아 저장해둔
// "spiderLatest:<origin>"을 그대로 그린다. 이 팝업은 추측하지 않는다 —
// 저장된 값이 없으면 빈 상태를 보여줄 뿐, 스스로 채워 넣지 않는다.
// ==================================================================
const MEE_NAMES = ["통찰력","응용력","전환","이미지영상","구체휘는","추측기법","전개도","청사진","상상기법","관찰력","순발력","예지력","주의력","신중함","추리력"];
const MEE_PASSIVE = new Set([7, 8, 14]);
const MEE_CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";

function drawMeeSvg(appliedNumbers) {
  const svg = document.getElementById("vizSvg");
  const applied = new Set(appliedNumbers || []);
  const cx = 110, cy = 110, r = 78;
  let html = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#33333c" stroke-width="1"/>`;
  for (let n = 1; n <= 15; n++) {
    const angle = ((n - 1) / 15) * Math.PI * 2 - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const isPassive = MEE_PASSIVE.has(n);
    const isOn = applied.has(n);
    let color = "#4a4a55";
    if (isPassive) color = "#e0b64f";
    else if (isOn) color = "#2ecc71";
    const lit = isPassive || isOn;
    html += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${lit ? color : "#2a2a32"}" stroke-width="${lit ? 1.4 : 1}" opacity="${lit ? 0.7 : 0.3}"/>`;
    html += `<circle cx="${x}" cy="${y}" r="9" fill="${lit ? color + "22" : "#26262e"}" stroke="${color}" stroke-width="1.5"/>`;
    html += `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="7.5" fill="${lit ? color : "#6f6f7a"}">${n}</text>`;
  }
  svg.innerHTML = html;
}

function renderMeeChips(state) {
  const box = document.getElementById("vizChips");
  box.innerHTML = "";
  const applied = new Set(state.appliedNumbers || []);
  for (let n = 1; n <= 15; n++) {
    const isPassive = MEE_PASSIVE.has(n);
    const isOn = applied.has(n);
    if (!isPassive && !isOn) continue;
    const span = document.createElement("span");
    span.className = "viz-chip " + (isPassive ? "pass" : "on");
    span.textContent = MEE_CIRCLED[n - 1] + MEE_NAMES[n - 1];
    box.appendChild(span);
  }
}

function renderMeeViz() {
  const emptyEl = document.getElementById("vizEmpty");
  const svgEl = document.getElementById("vizSvg");
  const chipsEl = document.getElementById("vizChips");
  currentTabOrigin((origin) => {
    if (!origin) { emptyEl.style.display = "block"; svgEl.style.display = "none"; chipsEl.style.display = "none"; return; }
    const key = "spiderLatest:" + origin;
    const query = {};
    query[key] = null;
    chrome.storage.local.get(query, (res) => {
      const state = res[key];
      if (!state) {
        emptyEl.style.display = "block";
        svgEl.style.display = "none";
        chipsEl.style.display = "none";
        return;
      }
      emptyEl.style.display = "none";
      svgEl.style.display = "block";
      chipsEl.style.display = "flex";
      drawMeeSvg(state.appliedNumbers);
      renderMeeChips(state);
    });
  });
}

renderMeeViz();
// 팝업이 열려있는 동안 새 응답이 오면 실시간 갱신
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (Object.keys(changes).some((k) => k.startsWith("spiderLatest:"))) {
    renderMeeViz();
  }
});

// 기존 "선택 텍스트를 localhost:8900로 전송" 기능. popup이 생기면서
// chrome.action.onClicked가 좌클릭에서 더 이상 안 뜨기 때문에, 여기서 같은
// 동작을 호출할 수 있게 버튼으로 노출한다(background.js의 runManualSend 재사용).
sendBtn.addEventListener("click", () => {
  sendBtn.disabled = true;
  statusEl.textContent = "전송 중...";

  chrome.runtime.sendMessage({ type: "MEE_SEND" }, (result) => {
    sendBtn.disabled = false;
    if (chrome.runtime.lastError) {
      statusEl.textContent = "오류: " + chrome.runtime.lastError.message;
      return;
    }
    if (result && result.ok) {
      statusEl.textContent = "전송 성공.";
    } else {
      const reason = result && result.reason ? result.reason : "알 수 없음";
      statusEl.textContent = "전송 실패 (" + reason + ")";
    }
  });
});
