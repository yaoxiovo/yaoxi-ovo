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
const API_KEY = 'sk-ea3e41bd90524efa83134a0e38c9bbc0'; 
const API_URL = 'https://api.deepseek.com/chat/completions';

const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');

// 自动滚动到底部的函数
function scrollToBottom() {
  chatHistory.scrollTo({
    top: chatHistory.scrollHeight,
    behavior: 'smooth' // 平滑滚动
  });
}

// 添加消息气泡并返回内容容器
function createMessageBubble(role) {
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  const contentSpan = document.createElement('span'); // 用于存放文字内容
  div.appendChild(contentSpan);
  chatHistory.appendChild(div);
  scrollToBottom();
  return contentSpan;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // 1. 发送用户消息
  const userBubble = createMessageBubble('user');
  userBubble.innerText = text;
  chatInput.value = '';

  // 2. 创建 AI 消息容器（初始为空）
  const aiContent = createMessageBubble('ai');
  aiContent.innerText = '...'; // 等待状态

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-reasoner", // 或者使用 deepseek-chat
        messages: [{ role: "user", content: text }],
        stream: true // 开启流式输出
      })
    });

    if (!response.ok) throw new Error('API 请求失败');

    // 3. 处理流式数据
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let isFirstChunk = true;
    aiContent.innerText = ''; // 清除等待状态

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
            const delta = data.choices[0].delta.content || "";
            
            if (delta) {
              aiContent.innerText += delta; // 逐字追加
              scrollToBottom(); // 每次追加内容都尝试下滑
            }
          } catch (e) {
            // 忽略部分解析错误
          }
        }
      }
    }

  } catch (error) {
    console.error(error);
    aiContent.innerText = "抱歉，连接 AI 时出现了一点小问题。";
  }
}

// 绑定回车键
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});
