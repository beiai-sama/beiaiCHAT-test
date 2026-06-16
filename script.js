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

let introTimer = null;
let introIndex = 0;
let introFinished = false;

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
    keys: ["北艾", "beiai", "Beiai"],
    flag: "beiai",
    log: "[KEY] 已记录关键词：北艾。",
    mood: "状态：识别到名称污染"
  },
  {
    keys: ["术力口", "vocaloid", "VOCALOID", "重音", "テト", "teto", "洛天依"],
    flag: "vocaloid",
    log: "[KEY] 已记录关键词：术力口 / 虚拟歌姬。",
    mood: "状态：声库残留被唤醒"
  },
  {
    keys: ["评论", "弹幕", "粉丝", "观众"],
    flag: "comment",
    log: "[KEY] 已记录关键词：评论 / 观众视角。",
    mood: "状态：外部评价接入"
  },
  {
    keys: ["歌词", "作品", "音乐", "歌"],
    flag: "lyric",
    log: "[KEY] 已记录关键词：歌词 / 作品。",
    mood: "状态：歌词档案出现裂缝"
  },
  {
    keys: ["你是谁", "你到底是谁", "我和你不知道的我", "你不知道的我", "另一个我"],
    flag: "identity",
    log: "[KEY] 已记录关键词：你不知道的我。",
    mood: "状态：身份校准失败"
  },
  {
    keys: ["二次元", "乱象", "CP", "乱磕", "厨力", "公式服", "饭圈"],
    flag: null,
    log: "[OBSERVE] 检测到二次元文化污染词。",
    mood: "状态：讽刺模块短暂上线"
  },
  {
    keys: ["AI", "ai", "DeepSeek", "deepseek", "人工智能"],
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

  connectionStatus.textContent = "连接状态：DeepSeek API / Cloudflare Worker 中转";
  addLog("[API] Worker 中转站已接入。");

  userInput.focus();

  chatForm.addEventListener("submit", handleSubmit);
  resetBtn.addEventListener("click", resetGame);
  restartBtn.addEventListener("click", resetGame);
}

function checkPortraitImage() {
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

    detectKeywords(reply);
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
      history: chatHistory.slice(-10)
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

    if (matched) {
      if (rule.flag && discoveredFlags[rule.flag] === false) {
        discoveredFlags[rule.flag] = true;
        addLog(rule.log);
      } else if (!rule.flag) {
        addLog(rule.log);
      }

      setMood(rule.mood);
    }
  }
}

function checkAllFlags() {
  if (firstStageUnlocked) return;

  const allFound = Object.values(discoveredFlags).every(Boolean);

  if (allFound) {
    firstStageUnlocked = true;

    addLog("[UNLOCK] 第一阶段关键词已全部记录。");
    addMessage(
      "system",
      "SYSTEM",
      "阶段提示：第一阶段关键词已收集完成。\n下一步：缺损文章 / 完形填空页面即将开放。"
    );

    setMood("状态：第一阶段取证完成");
  }
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
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addLog(text) {
  const li = document.createElement("li");
  li.textContent = text;
  systemLog.appendChild(li);

  while (systemLog.children.length > 12) {
    systemLog.removeChild(systemLog.children[0]);
  }
}

function setMood(text) {
  moodText.textContent = text;

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

  userInput.disabled = true;
  sendBtn.disabled = true;
  connectionStatus.textContent = "连接状态：终止 / SAN 值归零";
  setMood("状态：对话终止");

  addLog("[FATAL] SAN 值归零。对话终止。");
  addMessage(
    "system",
    "SYSTEM",
    "SAN 值归零。\nbeiaiCHAT 停止回应。\n你没有失败，只是当前版本不允许你继续深入。"
  );

  setTimeout(() => {
    gameOverOverlay.classList.remove("hidden");
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

  clearTimeout(decayTimer);

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
        你可以先随便和我说话。比如问：你是谁、北艾、术力口、二次元、评论、歌词。
      </div>
    </div>
  `;

  systemLog.innerHTML = `
    <li>[BOOT] beiaiCHAT-test 已重新启动。</li>
    <li>[API] Worker 中转站已接入。</li>
    <li>[INFO] 当前版本已尝试接入 DeepSeek。</li>
  `;

  userInput.disabled = false;
  sendBtn.disabled = false;
  sendBtn.textContent = "发送";
  userInput.value = "";
  userInput.focus();

  connectionStatus.textContent = "连接状态：DeepSeek API / Cloudflare Worker 中转";
  moodText.textContent = "状态：待机中";

  gameOverOverlay.classList.add("hidden");

  updateSanUI();
  startSanDecay();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

startIntroSequence();