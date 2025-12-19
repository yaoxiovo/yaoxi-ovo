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

