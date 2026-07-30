function createTabSnapshot(tab) {
  return {
    tabId: Number.isInteger(tab?.id) ? tab.id : null,
    title: typeof tab?.title === "string" ? tab.title : "",
    url: typeof tab?.url === "string" ? tab.url : "",
    capturedAt: new Date().toISOString()
  };
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!Number.isInteger(tab.id)) {
    return;
  }

  try {
    await chrome.sidePanel.open({ tabId: tab.id });

    chrome.runtime.sendMessage(
      {
        type: "ACTIVE_TAB_CONTEXT",
        tab: createTabSnapshot(tab)
      },
      () => {
        // 패널이 아직 메시지 수신 준비 전이면 패널 자체의 초기 조회가 대신 처리한다.
        void chrome.runtime.lastError;
      }
    );
  } catch (error) {
    console.info(
      "Side Panel을 열지 못했습니다. 확장 아이콘을 다시 눌러주세요.",
      error
    );
  }
});
