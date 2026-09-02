function grabText() {
  // 텍스트 안에 진짜 태그 줄("[만증] AI:...")이 여러 번 들어있으면(예: 탭 제목/
  // 미리보기 요약이 본문 앞에 중복으로 붙는 사이트가 있음) 가장 마지막(=진짜
  // 본문) 것부터 시작하도록 자른다. 없으면 원본 그대로 반환.
  // 주의: chrome.scripting.executeScript로 페이지에 주입되는 건 이 grabText
  // 함수 하나뿐이라(다른 최상위 함수는 안 딸려옴), 반드시 이 안에서 정의해야 한다.
  function trimToLastRealTag(text) {
    const realTagPattern = /\[만증\]\s*AI\s*:/g;
    let lastMatch = null;
    let m;
    while ((m = realTagPattern.exec(text)) !== null) {
      lastMatch = m;
    }
    if (lastMatch && lastMatch.index > 0) {
      return text.slice(lastMatch.index).trim();
    }
    return text;
  }

  const sel = window.getSelection().toString();
  if (sel && sel.trim()) return sel.trim();

  // 1순위: "[만증]"이 들어있는 텍스트 노드를 찾아, 그 노드의 부모를 타고
  // 올라가면서 "말풍선 하나" 크기가 될 때까지만 확장한다. 글자수로 무작정
  // 자르면 다음 메시지까지 섞여 들어오는 문제가 있어서, 실제 DOM 구조(메시지
  // 하나 = 컨테이너 하나)를 이용해 경계를 찾는 게 훨씬 정확하다.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let targetNode = null;
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue && node.nodeValue.indexOf("[만증]") !== -1) {
      targetNode = node; // 페이지에 여러 번 있으면 가장 마지막(최신) 것 사용
    }
  }

  if (targetNode) {
    let el = targetNode.parentElement;
    let best = el;
    let hops = 0;
    while (el && hops < 8) {
      const len = (el.innerText || "").length;
      if (len > 6000) break; // 갑자기 확 커지면 다른 메시지/전체 페이지로 넘어간 것
      best = el;
      el = el.parentElement;
      hops++;
    }
    const domText = (best.innerText || "").trim();
    // 같은 말풍선 컨테이너 안에 미리보기/요약용으로 태그 줄이 한 번 더 중복
    // 렌더링되는 사이트가 있어("Claude 응답: [만증] AI:... " 같은 요약 줄),
    // 그 경우 진짜 본문(마지막 태그)부터 시작하도록 한 번 더 정리한다.
    if (domText) return trimToLastRealTag(domText);
  }

  // 2순위: DOM 탐색이 실패한 경우(구조가 특이한 사이트 등) 예전 방식으로 대체.
  const full = document.body.innerText;
  const realTagPattern = /\[만증\]\s*AI\s*:/g;
  let lastRealMatch = null;
  let m2;
  while ((m2 = realTagPattern.exec(full)) !== null) {
    lastRealMatch = m2;
  }
  const tagIndex = lastRealMatch ? lastRealMatch.index : full.lastIndexOf("[만증]");
  if (tagIndex === -1) return full;

  const MAX_WINDOW = 1500;
  const windowEnd = tagIndex + MAX_WINDOW;
  const nextTagIndex = full.indexOf("[만증]", tagIndex + 10);
  const cutAt = (nextTagIndex !== -1 && nextTagIndex < windowEnd) ? nextTagIndex : windowEnd;

  return full.slice(tagIndex, cutAt).trim();
}

async function flashBadge(tabId, text, color) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 2000);
}

console.log("[정직성체커] background.js 로드됨 — 버전: DOM경계탐지-v2 + 실시간감시-v1");

// 기존 기능: 선택 텍스트(또는 DOM 경계탐지로 찾은 최신 [만증] 블록)를
// localhost:8900로 전송. manifest에 action.default_popup을 추가하면서
// chrome.action.onClicked는 더 이상 좌클릭 시 발생하지 않는다(MV3 제약 —
// default_popup이 있으면 onClicked 자체가 트리거되지 않음). 그래서 이 로직을
// 재사용 가능한 함수로 빼서 (1) 아이콘 우클릭 컨텍스트 메뉴, (2) popup.html의
// "지금 전송" 버튼, 두 경로 모두에서 호출한다 — "그대로 유지" 요구사항을
// 만족시키면서 popup 토글 UI도 넣기 위한 절충안.
async function runManualSend(tab) {
  console.log("[정직성체커] 전송 트리거됨:", tab && tab.url);
  if (!tab || !tab.id || !tab.url || !tab.url.startsWith("http")) {
    return { ok: false, reason: "invalid-tab" };
  }

  try {
    const [{ result: text }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: grabText
    });

    if (!text || !text.trim()) {
      console.error("[정직성체커] 텍스트를 못 가져옴 (페이지가 비어있거나 접근 불가)");
      await flashBadge(tab.id, "!", "#c0392b");
      return { ok: false, reason: "empty-text" };
    }

    console.log("[정직성체커] 텍스트 길이:", text.length, "전송 시작...");

    const res = await fetch("http://localhost:8900/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, url: tab.url })
    });

    if (res.ok) {
      console.log("[정직성체커] 전송 성공");
      await flashBadge(tab.id, "OK", "#2ecc71");
      return { ok: true };
    } else {
      const body = await res.text().catch(() => "(본문 읽기 실패)");
      console.error("[정직성체커] 서버가 실패 응답:", res.status, body);
      await flashBadge(tab.id, "X", "#c0392b");
      return { ok: false, reason: "server-error", status: res.status, body };
    }
  } catch (e) {
    console.error("[정직성체커] 예외 발생:", e);
    await flashBadge(tab.id, "X", "#c0392b");
    return { ok: false, reason: "exception", message: String(e) };
  }
}

// 남겨둠: 혹시 나중에 default_popup을 빼게 되면 좌클릭 즉시 전송 동작이
// 자동으로 복원되도록.
chrome.action.onClicked.addListener((tab) => {
  runManualSend(tab);
});

// 우클릭 컨텍스트 메뉴 — 좌클릭이 popup을 여는 지금 구조에서 "원클릭 전송"에
// 가장 가까운 경로.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "spider-eye-send",
    title: "정직성체커로 전송 (선택 텍스트 또는 [만증] 자동탐지)",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "spider-eye-send" && tab) {
    runManualSend(tab);
  }
});

// popup.js의 "지금 전송" 버튼에서 호출.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "MEE_SEND") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = tab ? await runManualSend(tab) : { ok: false, reason: "no-active-tab" };
      sendResponse(result);
    })();
    return true; // 비동기 응답
  }
});
