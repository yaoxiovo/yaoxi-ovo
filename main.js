/* === 原有基础逻辑 (保持不变) === */
function updateTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const clockEl = document.getElementById("clock");
  if(clockEl) clockEl.textContent = `${hours}:${minutes}`;
}
setInterval(updateTime, 1000);
updateTime();

const modal = document.getElementById("contact-modal");
const modalTitle = document.getElementById("modal-title");
const modalData = document.getElementById("modal-data");
const modalIcon = document.getElementById("modal-icon");
const toast = document.getElementById("copy-toast");
let currentData = "";

function openModal(type, data, iconClass) {
  modalTitle.innerText = type;
  modalData.innerText = data;
  currentData = data;
  modalIcon.className = iconClass;
  modal.classList.add("active");
}

function closeModal() { modal.classList.remove("active"); }
if(modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
}

function copyData() {
  navigator.clipboard.writeText(currentData).then(() => {
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2000);
  });
}

/* === AI 与身份验证逻辑 (整合优化版) === */
let USER_TOKEN = null;
const WORKER_URL = 'https://old-cake-08cc.yaoxiovo.workers.dev'; // 替换为你的 CF Worker URL
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');

// Google 登录回调函数
function handleCredentialResponse(response) {
  USER_TOKEN = response.credential;
  const overlay = document.getElementById('auth-overlay');
  if(overlay) overlay.style.display = 'none'; // 登录成功隐藏遮罩
  console.log("身份验证成功");
}

function scrollToBottom() {
  chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !USER_TOKEN) return;

  // 1. 添加用户消息
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-msg user';
  userDiv.innerText = text;
  chatHistory.appendChild(userDiv);
  chatInput.value = '';

  // 2. 创建 AI 消息气泡容器
  const aiBubble = document.createElement('div');
  aiBubble.className = 'chat-msg ai';
  
  const reasoningDiv = document.createElement('div');
  reasoningDiv.className = 'reasoning-box';
  reasoningDiv.innerText = '正在思考...';
  
  const contentSpan = document.createElement('span');
  
  aiBubble.appendChild(reasoningDiv);
  aiBubble.appendChild(contentSpan);
  chatHistory.appendChild(aiBubble);
  scrollToBottom();

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${USER_TOKEN}` // 携带 Token 传给 Worker
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages: [{ role: "user", content: text }],
        stream: true 
      })
    });

    if (!response.ok) throw new Error('请求失败');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let hasStartedReasoning = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') break;
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices[0].delta;

            if (delta.reasoning_content) {
              if (!hasStartedReasoning) { reasoningDiv.innerText = ''; hasStartedReasoning = true; }
              reasoningDiv.innerText += delta.reasoning_content;
              scrollToBottom();
            } else if (delta.content) {
              reasoningDiv.style.opacity = '0.7'; 
              contentSpan.innerText += delta.content;
              scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }
  } catch (error) {
    contentSpan.innerText = "出错了: " + error.message;
  }
}

if(chatInput) {
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}
