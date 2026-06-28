(function () {
    function updateClockAndTheme() {
        const now = new Date();
        const clockElement = document.getElementById("clock");
        if (clockElement) {
            const timeString = now.toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });
            clockElement.textContent = timeString;
        }

        const hour = now.getHours();
        document.documentElement.classList.toggle("light", hour >= 7 && hour < 19);
    }

    function showToast() {
        const toast = document.getElementById("copy-toast");
        if (!toast) return;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 1800);
    }

    async function copyText(text) {
        if (!text) return;

        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
    }

    document.addEventListener("DOMContentLoaded", () => {
        updateClockAndTheme();
        setInterval(updateClockAndTheme, 30 * 1000);

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducedMotion) {
            const bgVideo = document.querySelector(".background video");
            if (bgVideo) {
                bgVideo.pause();
                bgVideo.removeAttribute("autoplay");
            }
        }

        const contactModal = document.getElementById("contact-modal");
        const modalTitle = document.getElementById("modal-title");
        const modalData = document.getElementById("modal-data");
        const modalIcon = document.getElementById("modal-icon");
        const socialButtons = document.querySelectorAll(".social-btn[data-contact-title]");

        function openContactModal(title, value, iconClass) {
            if (!contactModal || !modalTitle || !modalData || !modalIcon) return;
            modalTitle.textContent = title;
            modalData.textContent = value;
            modalIcon.className = iconClass;
            contactModal.classList.add("active");
        }

        function closeContactModal() {
            if (contactModal) {
                contactModal.classList.remove("active");
            }
        }

        socialButtons.forEach((button) => {
            button.addEventListener("click", () => {
                openContactModal(
                    button.dataset.contactTitle || "联系方式",
                    button.dataset.contactValue || "",
                    button.dataset.contactIcon || "ri-chat-smile-3-line"
                );
            });
        });

        const closeButton = document.querySelector("[data-close-modal]");
        if (closeButton) {
            closeButton.addEventListener("click", closeContactModal);
        }

        const copyButton = document.querySelector("[data-copy-contact]");
        if (copyButton && modalData) {
            copyButton.addEventListener("click", async () => {
                try {
                    await copyText(modalData.textContent || "");
                    showToast();
                } catch (error) {
                    console.log("copy failed:", error);
                }
            });
        }

        if (contactModal) {
            contactModal.addEventListener("click", (event) => {
                const modalBox = contactModal.querySelector(".modal-box");
                if (modalBox && !modalBox.contains(event.target)) {
                    closeContactModal();
                }
            });
        }

        const audio = document.getElementById("bgMusic");
        const musicModal = document.getElementById("music-modal");
        const musicRemember = document.getElementById("music-remember");

        function closeMusicModal() {
            if (musicModal) {
                musicModal.classList.remove("active");
            }
        }

        async function playMusic() {
            if (!audio) return;
            audio.volume = 0.3;
            await audio.play();
        }

        if (audio && musicModal && musicRemember) {
            const autoPlayPref = localStorage.getItem("musicAutoPlay");

            if (autoPlayPref === "true") {
                playMusic().catch(() => {});
            } else if (autoPlayPref !== "false") {
                setTimeout(() => musicModal.classList.add("active"), 800);
            }

            musicModal.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;

                const modalBox = musicModal.querySelector(".modal-box");
                const choiceButton = target.closest("[data-music-choice]");
                if (choiceButton) {
                    const shouldPlay = choiceButton.getAttribute("data-music-choice") === "play";
                    const remember = musicRemember.checked;
                    if (shouldPlay) {
                        playMusic().catch(() => {});
                        if (remember) localStorage.setItem("musicAutoPlay", "true");
                    } else if (remember) {
                        localStorage.setItem("musicAutoPlay", "false");
                    }
                    closeMusicModal();
                    return;
                }

                if (modalBox && !modalBox.contains(target)) {
                    closeMusicModal();
                }
            });
        }

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            closeContactModal();
            closeMusicModal();
        });

        // 1. 3D 视差倾斜效果 (3D Parallax Tilt)
        const cards = document.querySelectorAll(".card");
        const isMouseDevice = window.matchMedia("(hover: hover)").matches;

        if (isMouseDevice) {
            cards.forEach((card) => {
                card.addEventListener("mousemove", (e) => {
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    // 计算归一化坐标 (-0.5 到 0.5)
                    const px = (x / rect.width) - 0.5;
                    const py = (y / rect.height) - 0.5;
                    
                    // 限制最大旋转 12deg
                    const rx = -py * 12;
                    const ry = px * 12;
                    
                    card.style.setProperty("--rx", `${rx}deg`);
                    card.style.setProperty("--ry", `${ry}deg`);
                    card.style.setProperty("--mx", `${x}px`);
                    card.style.setProperty("--my", `${y}px`);
                    
                    card.classList.add("tilt-effect");
                });

                card.addEventListener("mouseleave", () => {
                    card.classList.remove("tilt-effect");
                    card.style.setProperty("--rx", "0deg");
                    card.style.setProperty("--ry", "0deg");
                });
            });
        }

        // 2. Intersection Observer 触发技能进度条从 0% 加载
        const skillFills = document.querySelectorAll(".skill-fill");
        if ("IntersectionObserver" in window) {
            const skillObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const fill = entry.target;
                        const percent = fill.getAttribute("data-percent") || "0%";
                        fill.style.setProperty("--percent", percent);
                        skillObserver.unobserve(fill);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: "0px 0px -50px 0px"
            });

            skillFills.forEach((fill) => {
                skillObserver.observe(fill);
            });
        } else {
            // 降级：如果浏览器不支持 IntersectionObserver，直接加载百分比
            skillFills.forEach((fill) => {
                const percent = fill.getAttribute("data-percent") || "0%";
                fill.style.setProperty("--percent", percent);
            });
        }
    });

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            const register = () => {
                navigator.serviceWorker.register("/sw.js").catch((error) => {
                    console.log("SW failed:", error);
                });
            };

            if ("requestIdleCallback" in window) {
                window.requestIdleCallback(register, { timeout: 2500 });
            } else {
                setTimeout(register, 1200);
            }
        });
    }
})();
