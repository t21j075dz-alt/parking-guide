"use strict";

/* =========================================================
   駐車場空き区画案内：画面制御

   現段階では、駐車場・空き区画ともにデモデータを使用する。
   施設選択・絞り込み・デモ案内を管理する。
   位置情報と運転確認は location-safety.js で管理する。
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
    prefecture: "岡山県",
    municipality: "岡山市",
    category: "supermarket",
    availableCount: 12,
    latitude: 34.6841,
    longitude: 133.9262,
    demoDistance: 2.4,
  },
  {
    id: "trial-okayama-toyohama",
    name: "スーパーセンタートライアル岡山豊浜店",
    address: "岡山市南区豊浜町",
    prefecture: "岡山県",
    municipality: "岡山市",
    category: "supermarket",
    availableCount: 8,
    latitude: 34.6279,
    longitude: 133.9177,
    demoDistance: 3.1,
  },
  {
    id: "aeon-style-okayama-aoe",
    name: "イオンスタイル岡山青江",
    address: "岡山市北区青江二丁目",
    prefecture: "岡山県",
    municipality: "岡山市",
    category: "supermarket",
    availableCount: 5,
    latitude: 34.6309,
    longitude: 133.9106,
    demoDistance: 4.0,
  },

  {
    id: "ous-main-gate-experiment",
    name: "実験用駐車場（岡山理科大学正門）",
    address: "岡山県岡山市北区理大町1-1 岡山理科大学正門",
    prefecture: "岡山県",
    municipality: "岡山市",
    category: "experiment",
    availableCount: 8,
    latitude: 34.6998,
    longitude: 133.9280,
    demoDistance: 0.8,
  },
  {
    id: "handsman-kusami",
    name: "ハンズマンくさみ店",
    address: "福岡県北九州市小倉南区大字朽網字草見3914-21",
    prefecture: "福岡県",
    municipality: "北九州市",
    category: "home-center",
    availableCount: 8,
    latitude: 33.8073,
    longitude: 130.9673,
    demoDistance: 285.0,
  },
  {
    id: "handsman-onojo",
    name: "ハンズマン大野城店",
    address: "福岡県大野城市南大利1丁目5番1号",
    prefecture: "福岡県",
    municipality: "大野城市",
    category: "home-center",
    availableCount: 8,
    latitude: 33.5127,
    longitude: 130.4766,
    demoDistance: 337.0,
  },
  {
    id: "cainz-okayama-minami",
    name: "カインズ岡山南店",
    address: "岡山県岡山市南区海岸通2丁目4-15",
    prefecture: "岡山県",
    municipality: "岡山市",
    category: "home-center",
    availableCount: 8,
    latitude: 34.5963,
    longitude: 133.9323,
    demoDistance: 8.5,
  },
  {
    id: "marunaka-nakaicho",
    name: "マルナカ中井町店",
    address: "岡山県岡山市北区中井町1丁目280-2",
    prefecture: "岡山県",
    municipality: "岡山市",
    category: "supermarket",
    availableCount: 8,
    latitude: 34.6819,
    longitude: 133.9260,
    demoDistance: 2.0,
  },
  {
    id: "marunaka-muscat",
    name: "マルナカマスカット店",
    address: "岡山県倉敷市松島1154-2",
    prefecture: "岡山県",
    municipality: "倉敷市",
    category: "supermarket",
    availableCount: 8,
    latitude: 34.6277,
    longitude: 133.7999,
    demoDistance: 12.5,
  },
  {
    id: "marunaka-sanyo",
    name: "マルナカ山陽店",
    address: "岡山県赤磐市下市133",
    prefecture: "岡山県",
    municipality: "赤磐市",
    category: "supermarket",
    availableCount: 8,
    latitude: 34.7505,
    longitude: 134.0151,
    demoDistance: 13.0,
  },
];

/** カテゴリの表示名。未登録のカテゴリも絞り込みに使用できる。 */
const CATEGORY_LABELS = {
  "home-center": "ホームセンター",
  supermarket: "スーパーマーケット",
  drugstore: "ドラッグストア",
  experiment: "実験用駐車場",
};

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
  searchRequestId: 0,
  filters: { prefecture: "", municipality: "", category: "" },
};

/* =========================================================
   DOM参照
   ========================================================= */

const facilityList = document.querySelector("#facility-list");
const filterForm = document.querySelector("#facility-filter-form");
const prefectureFilter = document.querySelector("#prefecture-filter");
const municipalityFilter = document.querySelector("#municipality-filter");
const categoryFilter = document.querySelector("#category-filter");
const resetFiltersButton = document.querySelector("#reset-filters-button");
const sortDistanceButton = document.querySelector("#sort-distance-button");
const facilityCount = document.querySelector("#facility-count");
const facilityEmpty = document.querySelector("#facility-empty");
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

/* =========================================================
   施設の絞り込みと距離表示
   ========================================================= */

/** 選択肢を作り直し、指定した選択値を反映する。 */
function setSelectOptions(select, items, defaultLabel, selectedValue = "") {
  select.replaceChildren(new Option(defaultLabel, ""));
  items.forEach(([value, label]) => select.add(new Option(label, value)));
  select.value = selectedValue;
}

/** 施設に登録された値を重複なく日本語順に取得する。 */
function getDistinctValues(facilities, key) {
  return [...new Set(facilities.map((facility) => facility[key]))].sort(
    (first, second) => first.localeCompare(second, "ja"),
  );
}

/** 都道府県に属する市町村を表示し、親条件と矛盾する選択を防ぐ。 */
function updateMunicipalityOptions() {
  const { prefecture } = state.filters;
  const municipalities = prefecture
    ? getDistinctValues(
        FACILITIES.filter((facility) => facility.prefecture === prefecture),
        "municipality",
      )
    : [];

  setSelectOptions(
    municipalityFilter,
    municipalities.map((value) => [value, value]),
    prefecture ? "すべての市町村" : "先に都道府県を選択",
  );
  municipalityFilter.disabled = !prefecture;
}

/** 初期の選択肢を施設データとカテゴリ定義から作る。 */
function initializeFilters() {
  setSelectOptions(
    prefectureFilter,
    getDistinctValues(FACILITIES, "prefecture").map((value) => [value, value]),
    "すべての都道府県",
  );
  setSelectOptions(categoryFilter, Object.entries(CATEGORY_LABELS), "すべてのカテゴリ");
  updateMunicipalityOptions();
}

/** 3条件のすべてに一致する施設を抽出する。空欄は条件に含めない。 */
function getFilteredFacilities() {
  return FACILITIES.filter((facility) =>
    Object.entries(state.filters).every(
      ([key, value]) => !value || facility[key] === value,
    ),
  );
}

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

  const clampedA = Math.min(1, Math.max(0, a));
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
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
  const sortedFacilities = getFilteredFacilities().sort(
    (first, second) => getFacilityDistance(first) - getFacilityDistance(second),
  );

  facilityList.replaceChildren();
  facilityCount.textContent = `${FACILITIES.length}件中 ${sortedFacilities.length}件を表示`;
  facilityEmpty.hidden = sortedFacilities.length > 0;

  sortedFacilities.forEach((facility) => {
    const article = document.createElement("article");
    article.className = "facility-card";

    const button = document.createElement("button");
    button.className = "facility-button";
    button.type = "button";
    button.dataset.facilityId = facility.id;

    button.innerHTML = `
      <span class="facility-main">
        <span class="facility-name"></span>
        <span class="facility-address"></span>
        <span class="facility-category"></span>
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
    button.querySelector(".facility-category").textContent = CATEGORY_LABELS[facility.category];
    updateFacilityDistance(button, facility);
    button.querySelector(".availability-count").textContent = `${facility.availableCount}台`;

    article.append(button);
    facilityList.append(article);
  });
}

/** GPS更新ではカードを移動せず、距離と読み上げ内容だけを更新する。 */
function updateFacilityDistance(button, facility) {
  const distance = getFacilityDistance(facility).toFixed(1);
  const source = state.userLocation ? "現在地から直線" : "デモ距離";
  button.querySelector(".facility-distance").textContent = `${source} 約${distance} km`;
  button.setAttribute(
    "aria-label",
    `${facility.name}、${CATEGORY_LABELS[facility.category]}、空き${facility.availableCount}台（デモ）、${source}約${distance}キロメートルを選ぶ`,
  );
}

/** 位置情報が更新された場合も、フォーカスとカードの並び順を保つ。 */
function updateFacilityDistances() {
  facilityList.querySelectorAll("[data-facility-id]").forEach((button) => {
    const facility = FACILITIES.find((item) => item.id === button.dataset.facilityId);
    if (facility) {
      updateFacilityDistance(button, facility);
    }
  });
}

/* =========================================================
   画面遷移
   ========================================================= */

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

  if (screenName === "facility") {
    renderFacilities();
  }

  if (addHistory) {
    window.history.pushState({ screen: screenName }, "", `#${screenName}`);
  }

  window.scrollTo({ top: 0, behavior: "auto" });

  if (moveFocus && !document.querySelector("#driving-dialog").open) {
    document.querySelector(`#${screenName}-title`)?.focus();
  }
}

/* =========================================================
   デモの区画検索と案内
   ========================================================= */

/**
 * B列12区画分のデモ判定結果を作る。
 * searchSequenceを加えることで、「空き状況を更新」を押すと配置が変わる。
 */
function createDemoParkingSpaces(searchSequence = state.searchSequence) {
  const baseOccupied = [2, 5, 8, 11];
  const shiftedOccupied = baseOccupied.map(
    (number) => ((number + searchSequence - 1) % 12) + 1,
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
    return availableSpaces.find((space) => space.isWide) ?? availableSpaces[0];
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
async function runSpaceSearch(priorityOverride = null) {
  if (!window.parkingSafety.guardOperation()) {
    return { cancelled: true };
  }

  if (!state.selectedFacility) {
    showScreen("facility");
    return { cancelled: true };
  }

  const checkedPriority = conditionForm.querySelector('input[name="priority"]:checked');
  state.selectedPriority = priorityOverride ?? checkedPriority?.value ?? "balanced";

  /* 外部操作から希望条件を受け取った場合も、画面の選択状態をそろえる。 */
  const matchingRadio = conditionForm.querySelector(
    `input[name="priority"][value="${state.selectedPriority}"]`,
  );
  if (matchingRadio) {
    matchingRadio.checked = true;
  }

  /* 遅れて届く検索結果で、別施設や新しい検索の結果を上書きしない。 */
  const requestId = ++state.searchRequestId;
  const facility = state.selectedFacility;
  const priority = state.selectedPriority;
  const sequence = state.searchSequence;
  state.recommendedSpace = null;

  if (state.currentScreen !== "result") {
    showScreen("result");
  }
  resultContent.hidden = true;
  searchStatus.textContent = "空き区画を確認しています…";

  return new Promise((resolve) => {
    window.setTimeout(() => {
      if (requestId !== state.searchRequestId || state.selectedFacility !== facility) {
        resolve({ cancelled: true });
        return;
      }

      const spaces = createDemoParkingSpaces(sequence);
      state.recommendedSpace = selectRecommendedSpace(spaces, priority);

      if (!state.recommendedSpace) {
        searchStatus.textContent = "条件に合う空き区画はありません。条件を変更してください。";
        resolve({ facility: facility.name, spaceId: null, priority });
        return;
      }

      spaceNumber.textContent = state.recommendedSpace.id;
      spaceDescription.textContent = `店舗入口まで約${state.recommendedSpace.entranceDistanceMeters} m（デモ値）`;
      priorityBadge.textContent = PRIORITY_LABELS[priority];
      updatedTime.textContent = `更新 ${new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())}`;

      renderParkingMap(spaces, state.recommendedSpace);
      searchStatus.textContent = `${facility.name}の空き区画を見つけました。`;
      resultContent.hidden = false;

      resolve({
        facility: facility.name,
        spaceId: state.recommendedSpace.id,
        priority,
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

/* =========================================================
   表示設定と初期化
   ========================================================= */

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
  state.searchRequestId += 1;
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
  if (!button) {
    return;
  }

  state.selectedFacility = FACILITIES.find(
    (facility) => facility.id === button.dataset.facilityId,
  );

  if (!state.selectedFacility) {
    return;
  }

  state.searchRequestId += 1;
  state.recommendedSpace = null;

  selectedFacilityName.textContent = `選択中：${state.selectedFacility.name}`;
  showScreen("condition");
});

textSizeButton.addEventListener("click", toggleTextSize);

filterForm.addEventListener("submit", (event) => event.preventDefault());

prefectureFilter.addEventListener("change", () => {
  state.filters.prefecture = prefectureFilter.value;
  state.filters.municipality = "";
  updateMunicipalityOptions();
  renderFacilities();
});

municipalityFilter.addEventListener("change", () => {
  state.filters.municipality = municipalityFilter.value;
  renderFacilities();
});

categoryFilter.addEventListener("change", () => {
  state.filters.category = categoryFilter.value;
  renderFacilities();
});

resetFiltersButton.addEventListener("click", () => {
  state.filters = { prefecture: "", municipality: "", category: "" };
  initializeFilters();
  renderFacilities();
});

sortDistanceButton.addEventListener("click", renderFacilities);

window.addEventListener("parking:locationchange", (event) => {
  state.userLocation = event.detail.location;
  updateFacilityDistances();
});

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
  if (!window.parkingSafety.guardOperation()) {
    window.history.pushState({ screen: state.currentScreen }, "", `#${state.currentScreen}`);
    return;
  }

  const requestedScreen = event.state?.screen;
  const canOpenScreen =
    requestedScreen === "facility" ||
    (requestedScreen === "condition" && state.selectedFacility) ||
    (["result", "guide"].includes(requestedScreen) && state.recommendedSpace);

  showScreen(canOpenScreen ? requestedScreen : "facility", {
    addHistory: false,
  });
});

/* =========================================================
   任意のWebMCP連携
   ========================================================= */

/**
 * 対応ブラウザでは、画面と同じ「空き区画を探す」操作を
 * WebMCPの構造化ツールとして登録する。未対応ブラウザでは何もしない。
 */
async function registerWebMcpTool() {
  const context = document.modelContext;
  if (!context?.registerTool) {
    return;
  }

  const lifecycle = new AbortController();

  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });

  try {
    await context.registerTool(
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
          if (!window.parkingSafety.guardOperation()) {
            throw new Error("運転確認が必要です。画面上で安全を確認してから再実行してください。");
          }

          if (!input || typeof input !== "object" || Array.isArray(input)) {
            throw new TypeError("入力はオブジェクトで指定してください。");
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
            throw new TypeError("駐車場IDまたは希望条件が正しくありません。");
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
  } catch {
    /* 任意の連携が未対応または登録に失敗しても、画面操作は続けられる。 */
  }
}

/* =========================================================
   初期表示
   ========================================================= */

restoreTextSize();
initializeFilters();
window.history.replaceState({ screen: "facility" }, "", "#facility");
showScreen("facility", { addHistory: false, moveFocus: false });
void registerWebMcpTool();
