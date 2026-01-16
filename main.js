// 时间更新逻辑
function updateTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  document.getElementById("clock").textContent = `${hours}:${minutes}`;
}

setInterval(updateTime, 1000);
updateTime();

/* --- 弹窗逻辑 --- */
const modal = document.getElementById("contact-modal");
const modalTitle = document.getElementById("modal-title");
const modalData = document.getElementById("modal-data");
const modalIcon = document.getElementById("modal-icon");
const toast = document.getElementById("copy-toast");
let currentData = "";

// 打开弹窗
function openModal(type, data, iconClass) {
  modalTitle.innerText = type;
  modalData.innerText = data;
  currentData = data;

  // 更新图标
  modalIcon.className = iconClass;

  // 显示弹窗
  modal.classList.add("active");
}

// 关闭弹窗
function closeModal() {
  modal.classList.remove("active");
}

// 点击遮罩层关闭
modal.addEventListener("click", function (e) {
  if (e.target === modal) {
    closeModal();
  }
});

// 复制功能
function copyData() {
  navigator.clipboard
    .writeText(currentData)
    .then(() => {
      // 显示复制成功提示
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2000);
    })
    .catch((err) => {
      console.error("复制失败:", err);
      // 如果浏览器不支持 Clipboard API，使用备用方案
      const textArea = document.createElement("textarea");
      textArea.value = currentData;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      toast.innerText = "已复制";
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2000);
    });
}
// DeepSeek API 配置
const API_KEY = 'sk-ea3e41bd90524efa83134a0e38c9bbc0'; // ⚠️ 警告：千万不要将带有真实Key的代码上传到GitHub！
const API_URL = 'https://api.deepseek.com/chat/completions';

const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// 添加消息到界面
function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerText = text; // 使用innerText防止XSS注入
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight; // 自动滚动到底部
}

// 发送消息的主函数
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // 1. 显示用户消息
  appendMessage('user', text);
  chatInput.value = '';
  
  // 2. 显示“思考中”状态
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-msg ai typing';
  loadingDiv.innerText = '思考中';
  chatHistory.appendChild(loadingDiv);

  try {
    // 3. 调用 DeepSeek API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-reasoner", // R1 模型的 API 名称
        messages: [
          { role: "system", content: "你是一个嵌入在个人主页的智能助手，回答要简洁有趣。" },
          { role: "user", content: text }
        ],
        stream: false 
      })
    });

    const data = await response.json();
    
    // 移除“思考中”
    chatHistory.removeChild(loadingDiv);

    if (data.choices && data.choices[0]) {
      // R1 有时候会返回 reasoning_content (思维链)，这里我们只显示最终 content
      const reply = data.choices[0].message.content;
      appendMessage('ai', reply);
    } else {
      appendMessage('ai', '出错了，请稍后再试。');
    }

  } catch (error) {
    console.error(error);
    chatHistory.removeChild(loadingDiv);
    appendMessage('ai', '网络连接失败，请检查控制台。');
  }
}

// 监听回车键发送
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

