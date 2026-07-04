(function () {
    // --- 1. 时钟与主题控制 ---
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

    // --- 2. 导航栏滚动与响应式交互 ---
    function initNavbar() {
        const nav = document.querySelector(".tencent-nav");
        const navToggle = document.getElementById("navToggle");
        const navMenu = document.getElementById("navMenu");
        
        if (nav) {
            window.addEventListener("scroll", () => {
                if (window.scrollY > 50) {
                    nav.classList.add("scrolled");
                } else {
                    nav.classList.remove("scrolled");
                }
            });
        }

        if (navToggle && navMenu) {
            navToggle.addEventListener("click", () => {
                const expanded = navToggle.getAttribute("aria-expanded") === "true";
                navToggle.setAttribute("aria-expanded", !expanded);
                navMenu.classList.toggle("active");
                
                const icon = navToggle.querySelector("i");
                if (icon) {
                    icon.className = navMenu.classList.contains("active") ? "ri-close-line" : "ri-menu-line";
                }
            });

            // 点击菜单链接后自动关闭
            navMenu.querySelectorAll(".nav-item").forEach(link => {
                link.addEventListener("click", () => {
                    navMenu.classList.remove("active");
                    navToggle.setAttribute("aria-expanded", "false");
                    const icon = navToggle.querySelector("i");
                    if (icon) icon.className = "ri-menu-line";
                    
                    // 激活状态切换
                    navMenu.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
                    link.classList.add("active");
                });
            });
        }
    }

    // --- 3. 轮播图横幅逻辑 (Carousel Banner) ---
    function initCarousel() {
        const slides = document.querySelectorAll(".carousel-slide");
        const dots = document.querySelectorAll(".indicator-dot");
        const btnPrev = document.querySelector(".btn-prev");
        const btnNext = document.querySelector(".btn-next");
        
        if (slides.length === 0) return;

        let currentIndex = 0;
        let slideInterval = null;
        const intervalTime = 5000; // 5秒轮播

        function showSlide(index) {
            slides.forEach(slide => slide.classList.remove("active"));
            dots.forEach(dot => dot.classList.remove("active"));

            currentIndex = (index + slides.length) % slides.length;
            slides[currentIndex].classList.add("active");
            
            if (dots[currentIndex]) {
                dots[currentIndex].classList.add("active");
            }
        }

        function nextSlide() {
            showSlide(currentIndex + 1);
        }

        function prevSlide() {
            showSlide(currentIndex - 1);
        }

        function startAutoPlay() {
            stopAutoPlay();
            slideInterval = setInterval(nextSlide, intervalTime);
        }

        function stopAutoPlay() {
            if (slideInterval) {
                clearInterval(slideInterval);
            }
        }

        if (btnNext) {
            btnNext.addEventListener("click", () => {
                nextSlide();
                startAutoPlay();
            });
        }

        if (btnPrev) {
            btnPrev.addEventListener("click", () => {
                prevSlide();
                startAutoPlay();
            });
        }

        dots.forEach(dot => {
            dot.addEventListener("click", () => {
                const index = parseInt(dot.getAttribute("data-index") || "0", 10);
                showSlide(index);
                startAutoPlay();
            });
        });

        // 鼠标移入暂停，移出继续
        const carousel = document.querySelector(".hero-carousel");
        if (carousel) {
            carousel.addEventListener("mouseenter", stopAutoPlay);
            carousel.addEventListener("mouseleave", startAutoPlay);
        }

        startAutoPlay();
    }

    // --- 4. Cookie 偏好设置逻辑 ---
    function initCookieBanner() {
        const banner = document.getElementById("cookie-banner");
        const btnAccept = document.getElementById("btnAcceptCookies");
        const btnReject = document.getElementById("btnRejectCookies");
        const btnClose = document.getElementById("btnCloseCookies");

        if (!banner) return;

        const authorized = localStorage.getItem("cookiesAuthorized");
        if (!authorized) {
            setTimeout(() => {
                banner.classList.add("active");
            }, 1000);
        }

        function closeBanner() {
            banner.classList.remove("active");
            localStorage.setItem("cookiesAuthorized", "true");
        }

        if (btnAccept) btnAccept.addEventListener("click", closeBanner);
        if (btnReject) btnReject.addEventListener("click", closeBanner);
        if (btnClose) btnClose.addEventListener("click", closeBanner);

        const triggerCookie = document.getElementById("triggerCookieSettings");
        if (triggerCookie) {
            triggerCookie.addEventListener("click", (e) => {
                e.preventDefault();
                banner.classList.add("active");
            });
        }
    }

    // --- 5. 复制剪贴板与模态弹窗逻辑 ---
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

    function initModals() {
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

        const triggerQQLines = document.querySelectorAll(".trigger-qq");
        triggerQQLines.forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                openContactModal("QQ", "3487445594", "ri-qq-fill");
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

        // --- 背景音乐 Modal ---
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
                setTimeout(() => musicModal.classList.add("active"), 1200);
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
    }

    // --- 6. 3D 视差倾斜动效 (3D Parallax Tilt) ---
    function initParallax() {
        const cards = document.querySelectorAll(".card");
        const isMouseDevice = window.matchMedia("(hover: hover)").matches;

        if (isMouseDevice) {
            cards.forEach((card) => {
                card.addEventListener("mousemove", (e) => {
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    const px = (x / rect.width) - 0.5;
                    const py = (y / rect.height) - 0.5;
                    
                    const rx = -py * 8;
                    const ry = px * 8;
                    
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
    }

    // --- 7. 延迟加载与自动兜底加载技能条 ---
    function initSkillFill() {
        const skillFills = document.querySelectorAll(".skill-fill");
        
        function fillDirectly() {
            skillFills.forEach((fill) => {
                const percent = fill.getAttribute("data-percent") || "0%";
                fill.style.setProperty("--percent", percent);
            });
        }

        // 双保险兜底：1.5秒后无论 Observer 触发与否，全部强行把进度条拉满，确保动态必定正常显示
        const fallbackTimeout = setTimeout(fillDirectly, 1500);

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
                threshold: 0.05, // 降低阈值，更易触发
                rootMargin: "0px 0px -20px 0px"
            });

            skillFills.forEach((fill) => {
                skillObserver.observe(fill);
            });
        } else {
            fillDirectly();
        }
    }

    // --- 8. 实时抓取 Umami 真实运营数据统计 ---
    async function initUmamiStats() {
        const shareToken = "w6nUjtX9Tt5Gpr3D";
        const shareApiUrl = `https://umami.yaoxi.cloud/api/share/${shareToken}`;
        
        try {
            // 1. 获取包含 JWT Token 的分享数据
            const shareRes = await fetch(shareApiUrl, { headers: { 'Accept': 'application/json' } });
            if (!shareRes.ok) throw new Error("Failed to fetch share token details");
            const shareData = await shareRes.json();
            
            const websiteId = shareData.websiteId;
            const token = shareData.token;
            
            if (!websiteId || !token) throw new Error("Invalid share payload");
            
            // 2. 使用 token 作为 header 请求 stats 接口 (过去30天数据)
            const now = Date.now();
            const start = now - 30 * 24 * 60 * 60 * 1000;
            const statsUrl = `https://umami.yaoxi.cloud/api/websites/${websiteId}/stats?startAt=${start}&endAt=${now}`;
            
            const statsRes = await fetch(statsUrl, {
                headers: {
                    'Accept': 'application/json',
                    'x-umami-share-token': token
                }
            });
            if (!statsRes.ok) throw new Error("Failed to fetch stats data");
            const stats = await statsRes.json();
            
            // 3. 动态把真实数据渲染到主页 DOM 上！
            const uvEl = document.querySelector(".summary-item:nth-child(1) .summary-value");
            const pvEl = document.querySelector(".summary-item:nth-child(2) .summary-value");
            const stayEl = document.querySelector(".summary-item:nth-child(3) .summary-value");
            
            if (stats) {
                if (uvEl && typeof stats.visitors === 'number') {
                    uvEl.textContent = stats.visitors;
                }
                if (pvEl && typeof stats.pageviews === 'number') {
                    pvEl.textContent = stats.pageviews;
                }
                if (stayEl) {
                    let avgTimeStr = "2m 15s"; // 默认合理停留值
                    if (stats.pageviews > 0 && typeof stats.totaltime === 'number' && stats.totaltime > 0) {
                        const avgSeconds = Math.round(stats.totaltime / stats.pageviews);
                        if (avgSeconds >= 60) {
                            const m = Math.floor(avgSeconds / 60);
                            const s = avgSeconds % 60;
                            avgTimeStr = `${m}m ${s}s`;
                        } else {
                            avgTimeStr = `${avgSeconds}s`;
                        }
                    }
                    stayEl.textContent = avgTimeStr;
                }
            }
        } catch (err) {
            console.warn("Umami stats integration fetch failed, using beautiful mock display:", err);
        }
    }

    // --- 初始化执行 ---
    document.addEventListener("DOMContentLoaded", () => {
        updateClockAndTheme();
        setInterval(updateClockAndTheme, 30 * 1000);

        initNavbar();
        initCarousel();
        initCookieBanner();
        initModals();
        initParallax();
        initSkillFill();
        initUmamiStats(); // 开启真实 API 数据抓取与渲染
    });

    // --- 8. PWA Service Worker 注册 ---
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
