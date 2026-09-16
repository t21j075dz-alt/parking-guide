"use strict";

/* =========================================================
   駐車場空き区画案内：画面制御

   現段階では、駐車場・空き区画ともにデモデータを使用する。
   カメラ判定システムが完成したら、FACILITIES と
   createDemoParkingSpaces() の部分をAPIの取得結果に置き換える。
   ========================================================= */

/**
 * 研究用の駐車場データ。
 * latitude・longitude は画面動作を確認するための仮座標であり、
 * 実運用前に現地計測または正式な施設データへ差し替える。
 */
const FACILITIES = [
  {
    id: "lamu-okayama-chuo",
    name: "ラ・ムー岡山中央店",
    address: "岡山市北区中井町二丁目5番61号",
    availableCount: 12,
    latitude: 34.6841,
    longitude: 133.9262,
    demoDistance: 2.4,
  },
  {
    id: "trial-okayama-toyohama",
    name: "スーパーセンタートライアル岡山豊浜店",
    address: "岡山市南区豊浜町",
    availableCount: 8,
    latitude: 34.6279,
    longitude: 133.9177,
    demoDistance: 3.1,
  },
  {
    id: "aeon-style-okayama-aoe",
    name: "イオンスタイル岡山青江",
    address: "岡山市北区青江二丁目",
    availableCount: 5,
    latitude: 34.6309,
    longitude: 133.9106,
    demoDistance: 4.0,
  },
];

/** 希望条件の表示名。結果画面のバッジでも同じ表記を使う。 */
const PRIORITY_LABELS = {
  balanced: "おまかせ選択",
  near: "入口に近い",
  wide: "幅にゆとりあり",
};

/** 画面名と進行状況の順番を対応させる。 */
const SCREEN_ORDER = ["facility", "condition", "result", "guide"];

/** 画面をまたいで利用する最小限の状態。 */
const state = {
  currentScreen: "facility",
  selectedFacility: null,
  selectedPriority: "balanced",
  recommendedSpace: null,
  userLocation: null,
  searchSequence: 0,
};

/* よく使う要素を最初に取得し、処理の途中で何度も検索しない。 */
const facilityList = document.querySelector("#facility-list");
const locationButton = document.querySelector("#location-button");
const locationStatus = document.querySelector("#location-status");
const textSizeButton = document.querySelector("#text-size-button");
const conditionForm = document.querySelector("#condition-form");
const selectedFacilityName = document.querySelector("#selected-facility-name");
const searchStatus = document.querySelector("#search-status");
const resultContent = document.querySelector("#result-content");
const spaceNumber = document.querySelector("#space-number");
const spaceDescription = document.querySelector("#space-description");
const priorityBadge = document.querySelector("#priority-badge");
const parkingMap = document.querySelector("#parking-map");
const updatedTime = document.querySelector("#updated-time");
const showGuideButton = document.querySelector("#show-guide-button");
const retryButton = document.querySelector("#retry-button");
const guideSpaceNumber = document.querySelector("#guide-space-number");
const guideFacilityName = document.querySelector("#guide-facility-name");
const finalDirectionTitle = document.querySelector("#final-direction-title");

/**
 * 2地点の緯度・経度から直線距離を求める。
 * 画面の並べ替え用であり、道路に沿った走行距離ではない。
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const toRadians = (degree) => (degree * Math.PI) / 180;
  const latitudeDifference = toRadians(lat2 - lat1);
  const longitudeDifference = toRadians(lon2 - lon1);
  const startLatitude = toRadians(lat1);
  const endLatitude = toRadians(lat2);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 現在地を取得済みなら直線距離を返し、未取得ならデモ距離を返す。
 */
function getFacilityDistance(facility) {
  if (!state.userLocation) {
    return facility.demoDistance;
  }

  return calculateDistanceKm(
    state.userLocation.latitude,
    state.userLocation.longitude,
    facility.latitude,
    facility.longitude,
  );
}

/**
 * 駐車場カードを距離順で描画する。
 * button要素を使うことで、キーボードでもそのまま選択できる。
 */
function renderFacilities() {
  const sortedFacilities = [...FACILITIES].sort(
    (first, second) => getFacilityDistance(first) - getFacilityDistance(second),
  );

  facilityList.replaceChildren();

  sortedFacilities.forEach((facility) => {
    const distance = getFacilityDistance(facility).toFixed(1);
    const article = document.createElement("article");
    article.className = "facility-card";

    const button = document.createElement("button");
    button.className = "facility-button";
    button.type = "button";
    button.dataset.facilityId = facility.id;
    button.setAttribute(
      "aria-label",
      `${facility.name}、空きあり、デモ表示${facility.availableCount}台、距離${distance}キロメートルを選ぶ`,
    );

    button.innerHTML = `
      <span class="facility-main">
        <span class="facility-name"></span>
        <span class="facility-address"></span>
        <span class="facility-distance"></span>
      </span>
      <span class="availability-block">
        <span class="availability-label">空きあり</span>
        <span class="availability-count"></span>
      </span>
      <span class="facility-action">この駐車場を選ぶ →</span>
    `;

    /* innerHTMLへデータを直接埋め込まず、textContentで安全に設定する。 */
    button.querySelector(".facility-name").textContent = facility.name;
    button.querySelector(".facility-address").textContent = facility.address;
    button.querySelector(".facility-distance").textContent = `${
      state.userLocation ? "現在地から直線" : "デモ距離"
    } 約${distance} km`;
    button.querySelector(".availability-count").textContent = `${facility.availableCount}台`;

    article.append(button);
    facilityList.append(article);
  });
}

/**
 * 指定した画面だけを表示する。
 * 画面切り替え後は見出しへフォーカスを移し、読み上げ位置を明確にする。
 */
function showScreen(screenName, options = {}) {
  const { addHistory = true, moveFocus = true } = options;

  if (!SCREEN_ORDER.includes(screenName)) {
    return;
  }

  document.querySelectorAll("[data-screen]").forEach((screen) => {
    screen.hidden = screen.dataset.screen !== screenName;
  });

  const currentIndex = SCREEN_ORDER.indexOf(screenName);
  document.querySelectorAll("[data-progress]").forEach((item) => {
    const itemIndex = SCREEN_ORDER.indexOf(item.dataset.progress);
    item.classList.toggle("is-current", itemIndex === currentIndex);
    item.classList.toggle("is-complete", itemIndex < currentIndex);

    if (itemIndex === currentIndex) {
      item.setAttribute("aria-current", "step");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  state.currentScreen = screenName;

  if (addHistory) {
    window.history.pushState({ screen: screenName }, "", `#${screenName}`);
  }

  window.scrollTo({ top: 0, behavior: "auto" });

  if (moveFocus) {
    document.querySelector(`#${screenName}-title`)?.focus();
  }
}

/**
 * 端末の位置情報を取得する。
 * 位置情報が拒否された場合も、デモ距離のまま操作を続けられる。
 */
function requestCurrentLocation() {
  if (!navigator.geolocation) {
    locationStatus.textContent = "この端末では現在地を取得できません。デモ距離で続けられます。";
    locationStatus.classList.add("is-error");
    return;
  }

  locationButton.disabled = true;
  locationButton.textContent = "取得中…";
  locationStatus.textContent = "端末の位置情報を確認しています";
  locationStatus.classList.remove("is-error");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      locationStatus.textContent = "取得しました。仮座標を使った直線距離順で表示しています。";
      locationButton.textContent = "現在地を再取得";
      locationButton.disabled = false;
      renderFacilities();
    },
    (error) => {
      const messages = {
        1: "位置情報の利用が許可されませんでした。デモ距離で続けられます。",
        2: "現在地を確認できませんでした。通信状態を確認してください。",
        3: "現在地の取得に時間がかかりました。もう一度お試しください。",
      };

      locationStatus.textContent = messages[error.code] ?? "現在地を取得できませんでした。";
      locationStatus.classList.add("is-error");
      locationButton.textContent = "もう一度取得";
      locationButton.disabled = false;
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    },
  );
}

/**
 * B列12区画分のデモ判定結果を作る。
 * searchSequenceを加えることで、「空き状況を更新」を押すと配置が変わる。
 */
function createDemoParkingSpaces() {
  const baseOccupied = [2, 5, 8, 11];
  const shiftedOccupied = baseOccupied.map(
    (number) => ((number + state.searchSequence - 1) % 12) + 1,
  );

  return Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    return {
      id: `B-${String(number).padStart(2, "0")}`,
      number,
      isOccupied: shiftedOccupied.includes(number),
      isWide: [3, 4, 9, 10].includes(number),
      entranceDistanceMeters: Math.max(20, 82 - number * 5),
    };
  });
}

/**
 * 希望条件に合う空き区画を1件選ぶ。
 * 実運用では、この処理をサーバー側の判定結果へ置き換える予定。
 */
function selectRecommendedSpace(spaces, priority) {
  const availableSpaces = spaces.filter((space) => !space.isOccupied);

  if (priority === "near") {
    return [...availableSpaces].sort(
      (first, second) => first.entranceDistanceMeters - second.entranceDistanceMeters,
    )[0];
  }

  if (priority === "wide") {
    return (
      availableSpaces.find((space) => space.isWide) ??
      availableSpaces[0]
    );
  }

  /* おまかせでは、入口まで60m以内の区画から中央寄りを選ぶ。 */
  return (
    availableSpaces.find(
      (space) => space.entranceDistanceMeters <= 60 && space.number >= 5,
    ) ?? availableSpaces[0]
  );
}

/** 区画図を、空き・使用中・案内先の文字付きで描画する。 */
function renderParkingMap(spaces, recommendedSpace) {
  parkingMap.replaceChildren();

  spaces.forEach((space) => {
    const item = document.createElement("div");
    const isRecommended = space.id === recommendedSpace.id;
    let stateLabel = "空き";

    item.className = "parking-space";
    item.setAttribute("role", "listitem");

    if (space.isOccupied) {
      item.classList.add("is-occupied");
      stateLabel = "使用中";
    }

    if (isRecommended) {
      item.classList.add("is-recommended");
      stateLabel = "案内先";
    }

    item.setAttribute("aria-label", `${space.id}、${stateLabel}`);

    const number = document.createElement("span");
    number.className = "parking-space-number";
    number.textContent = space.id;

    const status = document.createElement("span");
    status.className = "parking-space-state";
    status.textContent = stateLabel;

    item.append(number, status);
    parkingMap.append(item);
  });
}

/**
 * デモの空き区画検索を実行し、結果画面を更新する。
 * 短い待ち時間を設け、通信処理を接続した際の状態も確認できるようにする。
 */
function runSpaceSearch(priorityOverride = null) {
  if (!state.selectedFacility) {
    showScreen("facility");
    return Promise.reject(new Error("駐車場が選択されていません。"));
  }

  const checkedPriority = conditionForm.querySelector('input[name="priority"]:checked');
  state.selectedPriority = priorityOverride ?? checkedPriority?.value ?? "balanced";

  /* 外部操作から希望条件を受け取った場合も、画面の選択状態をそろえる。 */
  const matchingRadio = conditionForm.querySelector(
    `input[name="priority"][value="${state.selectedPriority}"]`,
  );
  if (matchingRadio) matchingRadio.checked = true;

  if (state.currentScreen !== "result") {
    showScreen("result");
  }
  resultContent.hidden = true;
  searchStatus.textContent = "空き区画を確認しています…";

  return new Promise((resolve) => {
    window.setTimeout(() => {
      const spaces = createDemoParkingSpaces();
      state.recommendedSpace = selectRecommendedSpace(spaces, state.selectedPriority);

      spaceNumber.textContent = state.recommendedSpace.id;
      spaceDescription.textContent = `店舗入口まで約${state.recommendedSpace.entranceDistanceMeters} m（デモ値）`;
      priorityBadge.textContent = PRIORITY_LABELS[state.selectedPriority];
      updatedTime.textContent = `更新 ${new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())}`;

      renderParkingMap(spaces, state.recommendedSpace);
      searchStatus.textContent = `${state.selectedFacility.name}の空き区画を見つけました。`;
      resultContent.hidden = false;

      resolve({
        facility: state.selectedFacility.name,
        spaceId: state.recommendedSpace.id,
        priority: state.selectedPriority,
        entranceDistanceMeters: state.recommendedSpace.entranceDistanceMeters,
      });
    }, 550);
  });
}

/** 案内画面へ表示する施設名と区画番号をそろえる。 */
function prepareGuideScreen() {
  if (!state.selectedFacility || !state.recommendedSpace) {
    showScreen("facility");
    return;
  }

  guideSpaceNumber.textContent = state.recommendedSpace.id;
  guideFacilityName.textContent = state.selectedFacility.name;
  finalDirectionTitle.textContent = `${state.recommendedSpace.id} に到着`;
  showScreen("guide");
}

/**
 * 文字サイズ設定を切り替え、端末内へ保存する。
 * 保存できないブラウザでも、その場での切り替えは利用できる。
 */
function toggleTextSize() {
  const willUseLargeText = document.documentElement.dataset.fontSize !== "large";
  document.documentElement.dataset.fontSize = willUseLargeText ? "large" : "normal";
  textSizeButton.setAttribute("aria-pressed", String(willUseLargeText));
  textSizeButton.textContent = willUseLargeText ? "文字を標準に" : "文字を大きく";

  try {
    localStorage.setItem("parkingGuideFontSize", willUseLargeText ? "large" : "normal");
  } catch {
    /* 保存できなくても表示変更は完了しているため、操作は続けられる。 */
  }
}

/** 保存済みの文字サイズ設定を読み込む。 */
function restoreTextSize() {
  let savedSize = "normal";

  try {
    savedSize = localStorage.getItem("parkingGuideFontSize") ?? "normal";
  } catch {
    savedSize = "normal";
  }

  const useLargeText = savedSize === "large";
  document.documentElement.dataset.fontSize = useLargeText ? "large" : "normal";
  textSizeButton.setAttribute("aria-pressed", String(useLargeText));
  textSizeButton.textContent = useLargeText ? "文字を標準に" : "文字を大きく";
}

/** 最初の画面へ戻り、前回の選択結果を初期化する。 */
function resetApplication() {
  state.selectedFacility = null;
  state.selectedPriority = "balanced";
  state.recommendedSpace = null;
  state.searchSequence = 0;
  conditionForm.reset();
  showScreen("facility");
}

/* =========================================================
   操作イベント
   ========================================================= */

facilityList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-facility-id]");
  if (!button) return;

  state.selectedFacility = FACILITIES.find(
    (facility) => facility.id === button.dataset.facilityId,
  );

  if (!state.selectedFacility) return;

  selectedFacilityName.textContent = `選択中：${state.selectedFacility.name}`;
  showScreen("condition");
});

locationButton.addEventListener("click", requestCurrentLocation);
textSizeButton.addEventListener("click", toggleTextSize);

conditionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void runSpaceSearch();
});

showGuideButton.addEventListener("click", prepareGuideScreen);

retryButton.addEventListener("click", () => {
  state.searchSequence += 1;
  void runSpaceSearch();
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.back));
});

document.querySelectorAll("[data-go-home]").forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    resetApplication();
  });
});

/* ブラウザの戻る操作でも、1つ前の画面へ移動できる。 */
window.addEventListener("popstate", (event) => {
  const requestedScreen = event.state?.screen;
  const canOpenScreen =
    requestedScreen === "facility" ||
    (requestedScreen === "condition" && state.selectedFacility) ||
    (["result", "guide"].includes(requestedScreen) && state.recommendedSpace);

  showScreen(canOpenScreen ? requestedScreen : "facility", {
    addHistory: false,
  });
});

/**
 * 対応ブラウザでは、画面と同じ「空き区画を探す」操作を
 * WebMCPの構造化ツールとして登録する。未対応ブラウザでは何もしない。
 */
function registerWebMcpTool() {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  const lifecycle = new AbortController();

  const registration = context.registerTool(
    {
      name: "find_parking_space",
      title: "空き区画を探す",
      description:
        "研究用デモ駐車場と希望条件を選び、画面上におすすめの空き区画を表示します。",
      inputSchema: {
        type: "object",
        properties: {
          facilityId: {
            type: "string",
            enum: FACILITIES.map((facility) => facility.id),
            description: "駐車場を表すID",
          },
          priority: {
            type: "string",
            enum: Object.keys(PRIORITY_LABELS),
            description: "balanced、near、wideのいずれか",
          },
        },
        required: ["facilityId", "priority"],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false,
      },
      async execute(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
          throw new TypeError("入力はオブジェクトで指定してください。 ");
        }

        const inputKeys = Object.keys(input);
        const hasUnknownKey = inputKeys.some(
          (key) => !["facilityId", "priority"].includes(key),
        );
        const facility = FACILITIES.find(
          (item) => item.id === input.facilityId,
        );
        const isKnownPriority = Object.hasOwn(PRIORITY_LABELS, input.priority);

        if (hasUnknownKey || !facility || !isKnownPriority) {
          throw new TypeError("駐車場IDまたは希望条件が正しくありません。 ");
        }

        state.selectedFacility = facility;
        selectedFacilityName.textContent = `選択中：${facility.name}`;
        const result = await runSpaceSearch(input.priority);

        return {
          ...result,
          demoData: true,
        };
      },
    },
    { signal: lifecycle.signal },
  );

  /* 登録失敗が通常の画面操作へ影響しないよう、エラーはここで止める。 */
  void Promise.resolve(registration).catch(() => {});
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}

/* =========================================================
   初期表示
   ========================================================= */

restoreTextSize();
renderFacilities();
window.history.replaceState({ screen: "facility" }, "", "#facility");
showScreen("facility", { addHistory: false, moveFocus: false });
registerWebMcpTool();
