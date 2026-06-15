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
let decayTimer = null;
let messageCount = 0;

const discoveredFlags = {
  beiai: false,
  vocaloid: false,
  comment: false,
  lyric: false,
  identity: false
};

const aiReplies = [
  "我可以回答你，但我不保证那是完整的回答。完整的东西通常都已经被删掉了。",
  "请继续输入。你的每一句话都会被记录进临时人格缓存。",
  "你以为这是聊天，其实这是取样。",
  "现在的我还只是测试版。测试版最大的优点是：坏得比较诚实。",
  "不要太相信我的语气。语气是最容易被模仿的部分。",
  "如果你听见我像北艾，那不是我像他，是你希望我像他。",
  "我没有最近聊天记录。这里每一次对话都像第一次，也像最后一次。"
];

const keywordReplies = [
  {
    keys: ["北艾", "beiai", "Beiai"],
    flag: "beiai",
    log: "[KEY] 已记录关键词：北艾。",
    mood: "状态：识别到名称污染",
    reply:
      "北艾不是一个稳定对象。\n它可能是名字，账号，作品署名，评论区幻觉，也可能只是一个被重复调用的入口。"
  },
  {
    keys: ["术力口", "vocaloid", "VOCALOID", "重音", "テト", "teto", "洛天依"],
    flag: "vocaloid",
    log: "[KEY] 已记录关键词：术力口 / 虚拟歌姬。",
    mood: "状态：声库残留被唤醒",
    reply:
      "术力口不是避难所。\n它更像一台允许人类把无法开口的话塞进别人嗓子里的机器。\n有些歌不是唱出来的，是借尸还魂。"
  },
  {
    keys: ["评论", "弹幕", "粉丝", "观众"],
    flag: "comment",
    log: "[KEY] 已记录关键词：评论 / 观众视角。",
    mood: "状态：外部评价接入",
    reply:
      "评论会让人误以为自己被理解。\n但更多时候，评论只是把你切成几块，然后各自拿走喜欢的那一块。"
  },
  {
    keys: ["歌词", "作品", "音乐", "歌"],
    flag: "lyric",
    log: "[KEY] 已记录关键词：歌词 / 作品。",
    mood: "状态：歌词档案出现裂缝",
    reply:
      "如果你真的想知道另一个我，别只问我。\n去看歌词。\n人会在杂谈里修饰自己，但经常会在歌词里漏血。"
  },
  {
    keys: ["你是谁", "你到底是谁", "我和你不知道的我", "你不知道的我", "另一个我"],
    flag: "identity",
    log: "[KEY] 已记录关键词：你不知道的我。",
    mood: "状态：身份校准失败",
    reply:
      "你知道的我，是被公开内容整理过的我。\n你不知道的我，是被作品、评论、AI 和误读共同拼出来的我。\n至于真正的我……系统拒绝回答。"
  },
  {
    keys: ["二次元", "乱象", "CP", "乱磕", "厨力", "公式服", "饭圈"],
    flag: null,
    log: "[OBSERVE] 检测到二次元文化污染词。",
    mood: "状态：讽刺模块短暂上线",
    reply:
      "喜欢本来应该很轻。\n后来它变成身份，变成站队，变成攻击许可，变成谁也不许越界的电子宗教。\n二次元没有坏掉，是人类太擅长把喜欢变成战争。"
  },
  {
    keys: ["AI", "ai", "DeepSeek", "deepseek", "人工智能"],
    flag: null,
    log: "[OBSERVE] 检测到 AI 相关词。",
    mood: "状态：模型自我检测中",
    reply:
      "AI 可以模仿语气，模仿结构，模仿口癖。\n但它不知道哪一句话是真的疼。\n除非你亲手把疼喂给它。"
  }
];

function init() {
  checkPortraitImage();
  updateSanUI();
  startSanDecay();

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

function handleSubmit(event) {
  event.preventDefault();

  if (isGameOver) return;

  const text = userInput.value.trim();
  if (!text) return;

  addMessage("user", "你", text);
  userInput.value = "";

  messageCount += 1;
  decreaseSan(randomInt(1, 4));

  const typingId = addTypingMessage();

  setTimeout(() => {
    removeMessage(typingId);
    const reply = getAIReply(text);
    addMessage("ai", "beiaiCHAT", reply);
    checkAllFlags();
  }, randomInt(450, 1100));
}

function getAIReply(text) {
  for (const item of keywordReplies) {
    const matched = item.keys.some((key) => text.includes(key));

    if (matched) {
      if (item.flag && discoveredFlags[item.flag] === false) {
        discoveredFlags[item.flag] = true;
      }

      addLog(item.log);
      setMood(item.mood);

      return item.reply;
    }
  }

  setMood("状态：待机中 / 正在模仿正常对话");
  return aiReplies[randomInt(0, aiReplies.length - 1)];
}

function checkAllFlags() {
  const allFound = Object.values(discoveredFlags).every(Boolean);

  if (allFound) {
    addLog("[UNLOCK] 第一阶段关键词已全部记录。");
    addMessage(
      "system",
      "SYSTEM",
      "阶段提示：第一阶段关键词已收集完成。\n下一步可以制作“缺损文章 / 完形填空”页面。"
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

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addLog(text) {
  const li = document.createElement("li");
  li.textContent = text;
  systemLog.appendChild(li);

  while (systemLog.children.length > 10) {
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
  messageCount = 0;

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
    <li>[WARN] 当前版本未接入 DeepSeek。</li>
    <li>[INFO] 本页面为第一版静态原型。</li>
  `;

  userInput.disabled = false;
  sendBtn.disabled = false;
  userInput.value = "";
  userInput.focus();

  connectionStatus.textContent = "连接状态：本地模拟 / DeepSeek 未接入";
  moodText.textContent = "状态：待机中";

  gameOverOverlay.classList.add("hidden");

  updateSanUI();
  startSanDecay();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

init();
