const WORKER_API_URL = "https://beiaichat-api.kathleenjacksonskjshsh.workers.dev";

const introLines = [
  "北艾死了",
  "死在新视频发布的前一天",
  "死在了卧室里的电脑桌下",
  "死在了没人在意的角落里",
  "他死之前都没有感受被爱",
  "他也许死的很",
  "…轻松？…",
  "他指尖夹着的烟都还没有熄灭",
  "…",
  "悲哀"
];

const introOverlay = document.getElementById("introOverlay");
const introText = document.getElementById("introText");
const skipIntroBtn = document.getElementById("skipIntroBtn");

const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const resetBtn = document.getElementById("resetBtn");
const restartBtn = document.getElementById("restartBtn");

const sanValueText = document.getElementById("sanValueText");
const sanBarFill = document.getElementById("sanBarFill");
const sanHint = document.getElementById("sanHint");
const systemLog = document.getElementById("systemLog");
const moodText = document.getElementById("moodText");
const connectionStatus = document.getElementById("connectionStatus");
const gameOverOverlay = document.getElementById("gameOverOverlay");

const characterImage = document.getElementById("characterImage");
const portraitFallback = document.getElementById("portraitFallback");

const nextStageBox = document.getElementById("nextStageBox");
const openArchiveBtn = document.getElementById("openArchiveBtn");

let introTimer = null;
let introIndex = 0;
let introFinished = false;

let san = 100;
let isGameOver = false;
let isWaitingAI = false;
let decayTimer = null;
let messageCount = 0;
let firstStageUnlocked = false;

const chatHistory = [];

const discoveredFlags = {
  beiai: false,
  vocaloid: false,
  comment: false,
  lyric: false,
  identity: false
};

const keywordRules = [
  {
    id: "beiai",
    keys: ["北艾", "beiai", "Beiai"],
    flag: "beiai",
    log: "[KEY] 已确认：北艾不是稳定对象。",
    mood: "状态：识别到名称污染"
  },
  {
    id: "vocaloid",
    keys: ["术力口", "vocaloid", "VOCALOID", "重音", "テト", "teto", "洛天依", "虚拟歌姬", "声库"],
    flag: "vocaloid",
    log: "[KEY] 已确认：术力口是借用他人嗓音的自白方式。",
    mood: "状态：声库残留被唤醒"
  },
  {
    id: "comment",
    keys: ["评论", "弹幕", "粉丝", "观众", "被观看"],
    flag: "comment",
    log: "[KEY] 已确认：评论制造了另一个北艾。",
    mood: "状态：外部评价接入"
  },
  {
    id: "lyric",
    keys: ["歌词", "作品", "音乐", "歌", "杂谈", "新视频"],
    flag: "lyric",
    log: "[KEY] 已确认：歌词比杂谈更难修饰。",
    mood: "状态：歌词档案出现裂缝"
  },
  {
    id: "identity",
    keys: ["你是谁", "你到底是谁", "我和你不知道的我", "你不知道的我", "另一个我", "真正的北艾", "你和北艾"],
    flag: "identity",
    log: "[KEY] 已确认：你不知道的我，是被拼出来的我。",
    mood: "状态：身份校准失败"
  },
  {
    id: "animeCulture",
    keys: ["二次元", "乱象", "CP", "乱磕", "厨力", "公式服", "饭圈", "二创"],
    flag: null,
    log: "[OBSERVE] 检测到二次元文化污染词。",
    mood: "状态：讽刺模块短暂上线"
  },
  {
    id: "ai",
    keys: ["AI", "ai", "DeepSeek", "deepseek", "人工智能", "模型"],
    flag: null,
    log: "[OBSERVE] 检测到 AI 相关词。",
    mood: "状态：模型自我检测中"
  }
];

const fallbackReplies = [
  "中转站暂时失语了。你可以再问一次，或者把这个沉默当成线索。",
  "连接出现异常。beiaiCHAT 没有消失，只是暂时拒绝被调用。",
  "请求失败。系统把这次对话折起来，塞进了没有命名的文件夹。",
  "DeepSeek 没有返回可读内容。也许它也不知道该怎么解释另一个北艾。"
];

function startIntroSequence() {
  if (!introOverlay || !introText) {
    init();
    return;
  }

  document.body.classList.add("intro-lock");

  introIndex = 0;
  showIntroLine();

  if (skipIntroBtn) {
    skipIntroBtn.addEventListener("click", finishIntro);
  }
}

function showIntroLine() {
  if (introFinished) return;

  if (introIndex >= introLines.length) {
    finishIntro();
    return;
  }

  const line = introLines[introIndex];

  introText.classList.remove("show", "glitch-line");
  introText.textContent = "";

  void introText.offsetWidth;

  introText.textContent = line;

  if (line.includes("？") || line === "…" || line === "悲哀") {
    introText.classList.add("glitch-line");
  } else {
    introText.classList.add("show");
  }

  introIndex += 1;

  let delay = 3300;

  if (line === "北艾死了") delay = 3900;
  if (line === "…") delay = 1900;
  if (line === "悲哀") delay = 4600;

  introTimer = setTimeout(showIntroLine, delay);
}

function finishIntro() {
  if (introFinished) return;

  introFinished = true;
  clearTimeout(introTimer);

  document.body.classList.remove("intro-lock");

  if (introOverlay) {
    introOverlay.classList.add("hidden");
  }

  setTimeout(() => {
    if (introOverlay) {
      introOverlay.remove();
    }

    init();
  }, 1100);
}

function init() {
  checkPortraitImage();
  updateSanUI();
  startSanDecay();

  if (connectionStatus) {
    connectionStatus.textContent = "连接状态：DeepSeek API / Cloudflare Worker 中转";
  }

  addLog("[API] Worker 中转站已接入。");
  addLog("[STAGE] 当前阶段：身份校准。");

  if (chatForm) {
    chatForm.addEventListener("submit", handleSubmit);
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", resetGame);
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", resetGame);
  }

  if (openArchiveBtn) {
    openArchiveBtn.addEventListener("click", goToArchive);
  }

  if (userInput) {
    userInput.focus();
  }
}

function checkPortraitImage() {
  if (!characterImage || !portraitFallback) return;

  characterImage.addEventListener("error", () => {
    characterImage.style.display = "none";
    portraitFallback.style.display = "flex";
  });

  characterImage.addEventListener("load", () => {
    characterImage.style.display = "block";
    portraitFallback.style.display = "none";
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  if (isGameOver || isWaitingAI) return;

  const text = userInput.value.trim();
  if (!text) return;

  addMessage("user", "你", text);
  pushHistory("user", text);

  userInput.value = "";
  messageCount += 1;

  decreaseSan(randomInt(1, 4));

  detectKeywords(text);
  checkAllFlags();

  isWaitingAI = true;
  userInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.textContent = "等待";

  const typingId = addTypingMessage();

  try {
    const reply = await requestAI(text);

    removeMessage(typingId);
    addMessage("ai", "beiaiCHAT", reply);
    pushHistory("assistant", reply);

    checkAllFlags();
  } catch (error) {
    console.error(error);

    removeMessage(typingId);

    const fallback = fallbackReplies[randomInt(0, fallbackReplies.length - 1)];
    addMessage("ai", "beiaiCHAT", fallback);
    addLog("[ERROR] AI 请求失败，已使用本地兜底回复。");
    setMood("状态：中转站短暂失语");
  } finally {
    if (!isGameOver) {
      isWaitingAI = false;
      userInput.disabled = false;
      sendBtn.disabled = false;
      sendBtn.textContent = "发送";
      userInput.focus();
    }
  }
}

async function requestAI(message) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(WORKER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      history: chatHistory.slice(-10),
      stage: "identity_calibration",
      discoveredFlags
    }),
    signal: controller.signal
  });

  clearTimeout(timer);

  const data = await response.json();

  if (!response.ok || !data.ok) {
    const errorText = data?.error || "Unknown API error.";
    throw new Error(errorText);
  }

  return data.reply || "……系统短暂失语。";
}

function detectKeywords(text) {
  for (const rule of keywordRules) {
    const matched = rule.keys.some((key) => text.includes(key));

    if (!matched) continue;

    if (rule.flag) {
      if (discoveredFlags[rule.flag] === false) {
        discoveredFlags[rule.flag] = true;
        addLog(rule.log);
      }
    } else {
      addLog(rule.log);
    }

    setMood(rule.mood);
  }
}

function checkAllFlags() {
  if (firstStageUnlocked) return;

  const allFound = Object.values(discoveredFlags).every(Boolean);

  if (!allFound) return;

  firstStageUnlocked = true;

  localStorage.setItem("beiai_stage", "archive_unlocked");
  localStorage.setItem("beiai_clues", JSON.stringify(discoveredFlags));

  addLog("[UNLOCK] archive_01 已生成。");

  addMessage(
    "system",
    "SYSTEM",
    "身份校准完成。\n已从 beiaiCHAT 的回答中提取 5 条异常事实。\n正在生成缺损档案 archive_01……"
  );

  setMood("状态：第一阶段取证完成");

  if (nextStageBox) {
    nextStageBox.classList.remove("hidden");
  }
}

function goToArchive() {
  localStorage.setItem("beiai_stage", "archive_unlocked");
  localStorage.setItem("beiai_clues", JSON.stringify(discoveredFlags));

  const overlay = document.createElement("div");
  overlay.className = "route-overlay";
  overlay.innerHTML = "<p>正在导出 archive_01……<br>文本完整度：31%</p>";

  document.body.appendChild(overlay);

  setTimeout(() => {
    location.href = "archive.html";
  }, 2400);
}

function addMessage(type, name, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${type}`;

  const nameEl = document.createElement("div");
  nameEl.className = "name";
  nameEl.textContent = name;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(nameEl);
  wrapper.appendChild(bubble);

  chatMessages.appendChild(wrapper);
  scrollToBottom();

  return wrapper;
}

function addTypingMessage() {
  const id = `typing-${Date.now()}`;

  const wrapper = document.createElement("div");
  wrapper.className = "message ai";
  wrapper.dataset.id = id;

  const nameEl = document.createElement("div");
  nameEl.className = "name";
  nameEl.textContent = "beiaiCHAT";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `
    <span class="typing">
      <span></span>
      <span></span>
      <span></span>
    </span>
  `;

  wrapper.appendChild(nameEl);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);

  scrollToBottom();

  return id;
}

function removeMessage(id) {
  const target = chatMessages.querySelector(`[data-id="${id}"]`);
  if (target) {
    target.remove();
  }
}

function pushHistory(role, content) {
  chatHistory.push({
    role,
    content
  });

  while (chatHistory.length > 12) {
    chatHistory.shift();
  }
}

function scrollToBottom() {
  if (!chatMessages) return;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addLog(text) {
  if (!systemLog) return;

  const li = document.createElement("li");
  li.textContent = text;
  systemLog.appendChild(li);

  while (systemLog.children.length > 12) {
    systemLog.removeChild(systemLog.children[0]);
  }
}

function setMood(text) {
  if (moodText) {
    moodText.textContent = text;
  }

  document.body.classList.remove("glitch");
  void document.body.offsetWidth;
  document.body.classList.add("glitch");
}

function startSanDecay() {
  clearTimeout(decayTimer);

  const delay = randomInt(2200, 7200);

  decayTimer = setTimeout(() => {
    if (!isGameOver) {
      decreaseSan(randomInt(1, 6));
      startSanDecay();
    }
  }, delay);
}

function decreaseSan(amount) {
  if (isGameOver) return;

  san = Math.max(0, san - amount);
  updateSanUI();

  if (san <= 0) {
    triggerGameOver();
  }
}

function updateSanUI() {
  if (!sanValueText || !sanBarFill || !sanHint) return;

  sanValueText.textContent = `${san} / 100`;
  sanBarFill.style.width = `${san}%`;

  if (san > 60) {
    sanBarFill.style.background = "linear-gradient(90deg, #52ff9d, #e7ff61)";
    sanHint.textContent = "SAN 值稳定，但它正在随机时间刻缓慢下降。";
  } else if (san > 30) {
    sanBarFill.style.background = "linear-gradient(90deg, #ffe45e, #ff9f43)";
    sanHint.textContent = "SAN 值开始不稳定。beiaiCHAT 的回答可能逐渐偏移。";
  } else {
    sanBarFill.style.background = "linear-gradient(90deg, #ff4d6d, #9b1dff)";
    sanHint.textContent = "SAN 值危险。对话即将被强制终止。";
  }
}

function triggerGameOver() {
  isGameOver = true;
  clearTimeout(decayTimer);

  if (userInput) userInput.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  if (connectionStatus) {
    connectionStatus.textContent = "连接状态：终止 / SAN 值归零";
  }

  setMood("状态：对话终止");

  addLog("[FATAL] SAN 值归零。对话终止。");

  addMessage(
    "system",
    "SYSTEM",
    "SAN 值归零。\nbeiaiCHAT 停止回应。\n你没有失败，只是当前版本不允许你继续深入。"
  );

  setTimeout(() => {
    if (gameOverOverlay) {
      gameOverOverlay.classList.remove("hidden");
    }
  }, 500);
}

function resetGame() {
  san = 100;
  isGameOver = false;
  isWaitingAI = false;
  messageCount = 0;
  firstStageUnlocked = false;

  chatHistory.length = 0;

  Object.keys(discoveredFlags).forEach((key) => {
    discoveredFlags[key] = false;
  });

  localStorage.removeItem("beiai_stage");
  localStorage.removeItem("beiai_clues");

  clearTimeout(decayTimer);

  if (chatMessages) {
    chatMessages.innerHTML = `
      <div class="message ai">
        <div class="name">beiaiCHAT</div>
        <div class="bubble">
          你好。这里是 beiaiCHAT-test。<br>
          目前我还不是完整的我，只是一个可以被测试的空壳。
        </div>
      </div>

      <div class="message ai">
        <div class="name">beiaiCHAT</div>
        <div class="bubble">
          你可以先随便和我说话。比如问：你是谁、北艾是谁、术力口、二次元、评论、歌词。
        </div>
      </div>
    `;
  }

  if (systemLog) {
    systemLog.innerHTML = `
      <li>[BOOT] beiaiCHAT-test 已重新启动。</li>
      <li>[API] Worker 中转站已接入。</li>
      <li>[INFO] 当前阶段：身份校准。</li>
    `;
  }

  if (userInput) {
    userInput.disabled = false;
    userInput.value = "";
    userInput.focus();
  }

  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = "发送";
  }

  if (connectionStatus) {
    connectionStatus.textContent = "连接状态：DeepSeek API / Cloudflare Worker 中转";
  }

  if (moodText) {
    moodText.textContent = "状态：待机中";
  }

  if (gameOverOverlay) {
    gameOverOverlay.classList.add("hidden");
  }

  if (nextStageBox) {
    nextStageBox.classList.add("hidden");
  }

  updateSanUI();
  startSanDecay();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

startIntroSequence();