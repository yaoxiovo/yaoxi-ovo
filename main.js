(function () {
    const LANGUAGE_STORAGE_KEY = "yaoxiLanguage";
    const SUPPORTED_LANGUAGES = ["zh-CN", "zh-TW", "en"];
    const LANGUAGE_LOCALES = {
        "zh-CN": "zh-CN",
        "zh-TW": "zh-TW",
        "en": "en-US"
    };
    const THEME_STORAGE_KEY = "yaoxiTheme";
    const THEME_MODES = ["auto", "light", "dark"];
    const THEME_ICONS = {
        auto: "ri-contrast-2-line",
        light: "ri-sun-line",
        dark: "ri-moon-clear-line"
    };
    const THEME_COPY = {
        "zh-CN": {
            labels: {
                autoToLight: "主题跟随时间，点击切换到浅色模式",
                autoToDark: "主题跟随时间，点击切换到深色模式",
                light: "当前为浅色模式，点击切换到深色模式",
                dark: "当前为深色模式，点击恢复跟随时间"
            },
            status: {
                auto: "已恢复主题跟随时间",
                light: "已切换到浅色模式",
                dark: "已切换到深色模式"
            }
        },
        "zh-TW": {
            labels: {
                autoToLight: "主題跟隨時間，點擊切換至淺色模式",
                autoToDark: "主題跟隨時間，點擊切換至深色模式",
                light: "目前為淺色模式，點擊切換至深色模式",
                dark: "目前為深色模式，點擊恢復跟隨時間"
            },
            status: {
                auto: "已恢復主題跟隨時間",
                light: "已切換至淺色模式",
                dark: "已切換至深色模式"
            }
        },
        "en": {
            labels: {
                autoToLight: "Theme follows local time. Switch to light mode",
                autoToDark: "Theme follows local time. Switch to dark mode",
                light: "Light mode active. Switch to dark mode",
                dark: "Dark mode active. Return to automatic mode"
            },
            status: {
                auto: "Theme now follows local time",
                light: "Light mode enabled",
                dark: "Dark mode enabled"
            }
        }
    };

    const UI_COPY = {
        "跳过导航，直达主体内容": { "zh-TW": "跳過導覽，直達主要內容", "en": "Skip navigation and go to main content" },
        "瑶曦": { "zh-TW": "瑤曦", "en": "Studio" },
        "简介": { "zh-TW": "簡介", "en": "About" },
        "项目": { "zh-TW": "專案", "en": "Projects" },
        "业务/技术": { "zh-TW": "方向/技術", "en": "Focus" },
        "社会价值": { "zh-TW": "社會價值", "en": "Impact" },
        "统计": { "zh-TW": "統計", "en": "Analytics" },
        "联系": { "zh-TW": "聯絡", "en": "Contact" },
        "瑶曦启动2026前端探索计划": { "zh-TW": "瑤曦啟動 2026 前端探索計畫", "en": "Yaoxi's 2026 Frontend Journey" },
        "专注于 HTML5、CSS3 与 JavaScript 前端技术的学习与探索，用代码连接热爱与现实，追逐交互艺术的无限可能喵~": { "zh-TW": "專注於 HTML5、CSS3 與 JavaScript 前端技術的學習與探索，用程式碼連結熱愛與現實，追逐互動藝術的無限可能。", "en": "Exploring HTML5, CSS3 and JavaScript to turn curiosity into expressive, thoughtful web experiences." },
        "致力于创造美观且实用的网页": { "zh-TW": "致力於創造美觀且實用的網頁", "en": "Beautiful Web Experiences, Built to Work" },
        "在高中繁忙的学业之余保持对计算机的热爱，在自学中沉淀技术，用优雅的设计 and 流畅的交互构筑纯粹的前端视界呜喵！": { "zh-TW": "在繁忙的高中課業之餘保持對電腦的熱愛，在自學中累積技術，以優雅設計與流暢互動構築純粹的前端視界。", "en": "Alongside a busy high-school schedule, I keep learning, designing and building polished interfaces with calm, fluid interaction." },
        "科技向善，探索开源的无限可能": { "zh-TW": "科技向善，探索開源的無限可能", "en": "Technology for Good, Powered by Open Source" },
        "秉承“用户为本 科技向善”的学习初心，关注前端无障碍 (A11y) 体验，用干净、优美、包容的代码为所有人提供平等的交互窗口喵呜！": { "zh-TW": "秉持「以使用者為本、科技向善」的初心，關注前端無障礙（A11y）體驗，以乾淨、優美且包容的程式碼，為每個人提供平等的互動入口。", "en": "Guided by human-centered technology, I care about accessible interfaces and clean, inclusive code that welcomes everyone." },
        "最新动态": { "zh-TW": "最新動態", "en": "Latest Updates" },
        "关于我 / 2026.07.04": { "zh-TW": "關於我 / 2026.07.04", "en": "About / 2026.07.04" },
        "你好，我是瑶曦 Yaoxi！": { "zh-TW": "你好，我是瑤曦 Yaoxi！", "en": "Hi, I'm Yaoxi!" },
        "一名正在自学前端的高二学生。专注于现代 Web 页面重构与简单 UI 设计，在学业繁忙的间隙依然保持着对计算机技术与编程的纯粹热爱喵。": { "zh-TW": "一名正在自學前端的高中生，專注於現代 Web 頁面重構與簡潔 UI 設計，在繁忙課業之間依然保持對電腦技術與程式設計的純粹熱愛。", "en": "A high-school student teaching myself frontend development, focused on modern web refactors and clean UI design while keeping a genuine love for code." },
        "了解详情": { "zh-TW": "瞭解詳情", "en": "Learn more" },
        "个人项目 / 2026.07.04": { "zh-TW": "個人專案 / 2026.07.04", "en": "Project / 2026.07.04" },
        "生活分享与实践站：瑶曦博客": { "zh-TW": "生活分享與實作站：瑤曦部落格", "en": "Notes, Life and Practice: Yaoxi Blog" },
        "记录我的技术折腾经历、日常随笔与前端学习沉淀。点击下方链接即可跳转到我的个人博客网站，跟本喵一起探索更广阔的 Web 世界吧喵~": { "zh-TW": "記錄技術折騰、日常隨筆與前端學習累積。點擊下方連結即可前往我的個人部落格，一起探索更廣闊的 Web 世界。", "en": "A home for build notes, everyday writing and frontend lessons. Visit the blog and explore a wider web with me." },
        "Blog 博客系统": { "zh-TW": "Blog 部落格系統", "en": "Yaoxi Blog" },
        "技术积累 / 2026.07.04": { "zh-TW": "技術累積 / 2026.07.04", "en": "Skills / 2026.07.04" },
        "前端核心技能与技术栈": { "zh-TW": "前端核心技能與技術棧", "en": "Frontend Skills and Stack" },
        "工程化研究 / 2026.07.04": { "zh-TW": "工程化研究 / 2026.07.04", "en": "Engineering / 2026.07.04" },
        "前端工程化与自动化部署": { "zh-TW": "前端工程化與自動化部署", "en": "Frontend Engineering and Automated Delivery" },
        "探索现代构建调优、Serverless 云函数、Git 自动化流。用高效的自动化工作流，构筑极速且极其稳定的前端研发与上线基石喵。": { "zh-TW": "探索現代建置調校、Serverless 雲端函式與 Git 自動化流程，以高效工作流打造快速、穩定的前端研發與部署基礎。", "en": "Exploring modern build tuning, Serverless functions and Git automation to create fast, dependable delivery workflows." },
        "阅读大纲": { "zh-TW": "閱讀大綱", "en": "View outline" },
        "设计美学 / 2026.07.04": { "zh-TW": "設計美學 / 2026.07.04", "en": "Design / 2026.07.04" },
        "人机交互与视觉色彩探索": { "zh-TW": "人機互動與視覺色彩探索", "en": "Interaction and Visual Design" },
        "学习扁平网格、平滑微动效与现代无框卡片视觉排版。用代码来重组设计语言，赋予静态页面以呼吸感，探索交互细节的精致之美呜喵。": { "zh-TW": "學習平面網格、平滑微動效與現代無框卡片排版，以程式碼重組設計語言，讓靜態頁面擁有呼吸感，探索互動細節之美。", "en": "Studying grid systems, subtle motion and modern card layouts to give static pages rhythm, clarity and refined interaction." },
        "查看详情": { "zh-TW": "查看詳情", "en": "View details" },
        "沟通交流 / 2026.07.04": { "zh-TW": "溝通交流 / 2026.07.04", "en": "Connect / 2026.07.04" },
        "沟通与技术交流渠道": { "zh-TW": "溝通與技術交流管道", "en": "Let's Talk and Share Ideas" },
        "欢迎各位开发者、同好及朋友前来交流学习心得！你可以点击下方按钮复制对应的联系方式，随时给本喵留言探讨问题喵呜！": { "zh-TW": "歡迎開發者、同好與朋友交流學習心得！點擊下方按鈕即可複製聯絡方式，隨時來聊聊技術與想法。", "en": "Developers, learners and friends are welcome. Use the buttons below to copy my contact details and start a conversation." },
        "QQ 联系": { "zh-TW": "QQ 聯絡", "en": "QQ" },
        "电子邮箱": { "zh-TW": "電子郵件", "en": "Email" },
        "业务 / 技术方向": { "zh-TW": "方向 / 技術領域", "en": "Focus Areas" },
        "交互与体验 (UI / UX)": { "zh-TW": "互動與體驗 (UI / UX)", "en": "Interaction and Experience (UI / UX)" },
        "致力于创造既美观又实用的网页界面。引入大厂扁平网格、线条极细拉伸与微光投影机制，给网页灌注极致流畅的过渡特效，在像素之间追求完美喵。": { "zh-TW": "致力於創造美觀且實用的網頁介面，結合平面網格、纖細線條與柔和光影，打造流暢過渡，在每個像素之間追求更好的體驗。", "en": "Creating interfaces that are both useful and beautiful, with disciplined grids, fine detail, soft light and fluid transitions." },
        "逻辑与架构 (Engineering)": { "zh-TW": "邏輯與架構 (Engineering)", "en": "Logic and Architecture (Engineering)" },
        "以现代 JS/TS 生态为驱动，编写高效且可复用性极强的页面组件。注重代码健壮性与可维护性，让自学的前端技能架构稳固如大厂体系呜喵。": { "zh-TW": "以現代 JS/TS 生態為核心，編寫高效且可重用的頁面元件，重視程式碼健壯性與可維護性，持續建立穩固的前端架構。", "en": "Building efficient, reusable components with the modern JS/TS ecosystem, with an emphasis on resilience and maintainability." },
        "云端与自动化 (Serverless)": { "zh-TW": "雲端與自動化 (Serverless)", "en": "Cloud and Automation (Serverless)" },
        "将静态主页、博客系统与轻量化的 Serverless 云服务完美整合。运用自动化编译部署管道，享受秒级全球热部署与边缘加速带来的极致性能体验喵。": { "zh-TW": "整合靜態首頁、部落格系統與輕量 Serverless 雲端服務，透過自動化建置部署與邊緣加速，提供快速穩定的使用體驗。", "en": "Connecting static sites, the blog and lightweight Serverless services through automated delivery and edge acceleration." },
        "科技向善": { "zh-TW": "科技向善", "en": "Technology for Good" },
        "用户为本，探索技术与社会的完美交织": { "zh-TW": "以使用者為本，探索技術與社會的交織", "en": "Human-Centered Technology with Real Impact" },
        "作为一个自学前端的开发者，瑶曦始终坚信：编程的真正魅力不仅仅是写出炫酷的代码，更是能够通过技术来连接人心、传递正能量喵。": { "zh-TW": "作為自學前端的開發者，瑤曦始終相信：程式設計的魅力不只在於寫出亮眼的程式碼，更在於透過技術連結彼此、傳遞正向力量。", "en": "As a self-taught frontend developer, I believe code matters most when it connects people and creates something genuinely positive." },
        "我们致力于在日常折腾和技术探索中，融入社会公益和可持续性价值的思考。无论是指引同行者的学习笔记，还是致力于提升每一位访客阅读体验的无障碍功能，我们都在一步一个脚印地去践行我们的愿景呜喵。": { "zh-TW": "在日常實作與技術探索中，我也持續思考公益與永續價值。從分享學習筆記到改善每位訪客的無障礙閱讀體驗，我們一步一步實踐這個願景。", "en": "From open learning notes to accessible reading experiences, each experiment is a small step toward a more open and sustainable web." },
        "教育共享与知识开放": { "zh-TW": "教育共享與知識開放", "en": "Open Learning and Shared Knowledge" },
        "向同是高中自学计算机的前端同行者无保留地公开和共享自己整理的几十万字学习记录与折腾日记，用开源共享缩短同龄人自学探索的弯路喵。": { "zh-TW": "向同樣自學電腦技術的高中生公開分享學習紀錄與實作日誌，透過開源交流，幫助同齡學習者少走一些彎路。", "en": "Sharing detailed notes and build logs with other young self-learners, so open knowledge can make the path a little clearer." },
        "网页无障碍与人道优化": { "zh-TW": "網頁無障礙與人本最佳化", "en": "Accessible and Inclusive Interfaces" },
        "遵循 WCAG 国际无障碍规范，在结构里做极致语义化重构，对屏幕阅读器及色障用户进行明暗对比度专门调校，消除技术的数字鸿沟喵。": { "zh-TW": "遵循 WCAG 國際無障礙規範，強化語意結構，並為螢幕閱讀器與色覺差異使用者調整對比，努力縮小數位落差。", "en": "Following WCAG, strengthening semantic structure and tuning contrast for screen readers and color-vision differences." },
        "关键指标": { "zh-TW": "關鍵指標", "en": "Key Metrics" },
        "探索股票代码 / Code": { "zh-TW": "探索代碼 / Code", "en": "Exploration Code" },
        "代码总提交数 / Commits": { "zh-TW": "程式碼提交數 / Commits", "en": "Total Commits" },
        "持续自学天数 / Study Days": { "zh-TW": "持續自學天數 / Study Days", "en": "Learning Days" },
        "开源累积获赞 / GitHub Stars": { "zh-TW": "開源累積獲讚 / GitHub Stars", "en": "GitHub Stars" },
        "网站统计": { "zh-TW": "網站統計", "en": "Site Analytics" },
        "数据大屏实时监测中 / Active": { "zh-TW": "即時資料監測中 / Active", "en": "Live monitoring / Active" },
        "点击进入完整大屏": { "zh-TW": "點擊查看完整面板", "en": "Open full dashboard" },
        "日均访客 (UV)": { "zh-TW": "日均訪客 (UV)", "en": "Daily visitors (UV)" },
        "累计浏览量 (PV)": { "zh-TW": "累計瀏覽量 (PV)", "en": "Total pageviews (PV)" },
        "平均停留时间": { "zh-TW": "平均停留時間", "en": "Average visit" },
        "探索频道": { "zh-TW": "探索頻道", "en": "Explore" },
        "HTML5 动画实验室": { "zh-TW": "HTML5 動畫實驗室", "en": "HTML5 Motion Lab" },
        "CSS3 3D特效馆": { "zh-TW": "CSS3 3D 特效館", "en": "CSS3 3D Gallery" },
        "JavaScript 游乐园": { "zh-TW": "JavaScript 遊樂園", "en": "JavaScript Playground" },
        "PWA 离线存储实验": { "zh-TW": "PWA 離線儲存實驗", "en": "PWA Offline Lab" },
        "旗下站点": { "zh-TW": "旗下站點", "en": "Sites" },
        "瑶曦博客系统": { "zh-TW": "瑤曦部落格系統", "en": "Yaoxi Blog" },
        "数据开发工具箱": { "zh-TW": "資料開發工具箱", "en": "Data Toolkit" },
        "图片隐写与盲水印": { "zh-TW": "圖片隱寫與盲浮水印", "en": "Steganography and Watermarking" },
        "Umami 流量仪表盘": { "zh-TW": "Umami 流量儀表板", "en": "Umami Dashboard" },
        "友情链接": { "zh-TW": "友情連結", "en": "Friends" },
        "星浴 (xingyu.ink)": { "zh-TW": "星浴 (xingyu.ink)", "en": "Xingyu (xingyu.ink)" },
        "无障碍与合规": { "zh-TW": "無障礙與合規", "en": "Accessibility and Policies" },
        "WCAG 无障碍规范": { "zh-TW": "WCAG 無障礙規範", "en": "WCAG Guidelines" },
        "Cookies 偏好设定": { "zh-TW": "Cookies 偏好設定", "en": "Cookie Preferences" },
        "个人隐私保护政策": { "zh-TW": "個人隱私保護政策", "en": "Privacy Policy" },
        "技术漏洞安全上报": { "zh-TW": "技術漏洞安全通報", "en": "Security Report" },
        "关注我 / Connect": { "zh-TW": "關注我 / Connect", "en": "Connect" },
        "GitHub 仓库": { "zh-TW": "GitHub 儲存庫", "en": "GitHub" },
        "开发者同盟论坛": { "zh-TW": "開發者交流論壇", "en": "Developer Community" },
        "© 2026 Yaoxi. All Rights Reserved. 瑶曦网络科技版权所有": { "zh-TW": "© 2026 Yaoxi. All Rights Reserved. 瑤曦網路科技版權所有", "en": "© 2026 Yaoxi. All Rights Reserved." },
        "您的Cookies偏好": { "zh-TW": "您的 Cookies 偏好", "en": "Your Cookie Preferences" },
        "欢迎来到 yaoxi.wiki！我们希望使用分析型Cookies和类似技术（“Cookies”）来改善我们的网站。Cookies收集的信息不会识别您个人。有关我们使用的Cookies的类型以及您的偏好选项（包括如何更改您的偏好设置）的更多信息，请查看此处的": { "zh-TW": "歡迎來到 yaoxi.wiki！我們希望使用分析型 Cookies 與類似技術改善網站。這些資訊不會用來識別您的身分。若要瞭解 Cookie 類型與偏好設定方式，請查看", "en": "Welcome to yaoxi.wiki. We use optional analytics cookies to improve the site without identifying you. For details and preference controls, see our" },
        "Cookies政策": { "zh-TW": "Cookies 政策", "en": "Cookie Policy" },
        "。": { "zh-TW": "。", "en": "." },
        "拒绝所有分析型Cookies": { "zh-TW": "拒絕所有分析型 Cookies", "en": "Reject analytics" },
        "接受所有分析型Cookies": { "zh-TW": "接受所有分析型 Cookies", "en": "Accept analytics" },
        "已复制到剪贴板": { "zh-TW": "已複製到剪貼簿", "en": "Copied to clipboard" },
        "联系方式": { "zh-TW": "聯絡方式", "en": "Contact details" },
        "点击下方按钮即可复制": { "zh-TW": "點擊下方按鈕即可複製", "en": "Use the button below to copy" },
        "关闭": { "zh-TW": "關閉", "en": "Close" },
        "复制": { "zh-TW": "複製", "en": "Copy" },
        "播放音乐": { "zh-TW": "播放音樂", "en": "Play Music" },
        "是否播放背景音乐？": { "zh-TW": "是否播放背景音樂？", "en": "Play background music?" },
        "记住我的选择": { "zh-TW": "記住我的選擇", "en": "Remember my choice" },
        "拒绝": { "zh-TW": "拒絕", "en": "Not now" },
        "播放": { "zh-TW": "播放", "en": "Play" },
        "瑶曦个人主页首页": { "zh-TW": "瑤曦個人首頁", "en": "Yaoxi homepage" },
        "选择语言": { "zh-TW": "選擇語言", "en": "Choose language" },
        "切换菜单": { "zh-TW": "切換選單", "en": "Toggle menu" },
        "瑶曦主页精选内容": { "zh-TW": "瑤曦首頁精選內容", "en": "Featured content" },
        "上一张": { "zh-TW": "上一張", "en": "Previous slide" },
        "下一张": { "zh-TW": "下一張", "en": "Next slide" },
        "选择幻灯片": { "zh-TW": "選擇投影片", "en": "Choose a slide" },
        "切换到第 1 张": { "zh-TW": "切換到第 1 張", "en": "Go to slide 1" },
        "切换到第 2 张": { "zh-TW": "切換到第 2 張", "en": "Go to slide 2" },
        "切换到第 3 张": { "zh-TW": "切換到第 3 張", "en": "Go to slide 3" },
        "瑶曦头像": { "zh-TW": "瑤曦頭像", "en": "Yaoxi avatar" },
        "前端开发核心技能": { "zh-TW": "前端開發核心技能", "en": "Core frontend skills" },
        "自动化部署与工程化": { "zh-TW": "自動化部署與工程化", "en": "Automation and engineering" },
        "交互交互与界面设计": { "zh-TW": "互動與介面設計", "en": "Interaction and interface design" },
        "与我沟通交流": { "zh-TW": "與我聯絡交流", "en": "Get in touch" },
        "关闭偏好设置": { "zh-TW": "關閉偏好設定", "en": "Close preferences" }
    };

    const PAGE_META = {
        "zh-CN": {
            title: "yaoxi | 瑶曦的个人主页 - 前端学习与探索",
            description: "瑶曦 Yaoxi 的个人主页，记录前端学习方向、项目链接与联系方式，专注于 HTML5、CSS3 与 JavaScript 前端技术的学习与探索。"
        },
        "zh-TW": {
            title: "yaoxi | 瑤曦的個人首頁 - 前端學習與探索",
            description: "瑤曦 Yaoxi 的個人首頁，記錄前端學習方向、專案連結與聯絡方式，專注於 HTML5、CSS3 與 JavaScript 前端技術。"
        },
        "en": {
            title: "Yaoxi | Frontend Learner and UI Explorer",
            description: "Yaoxi's personal site for frontend learning, interface experiments, projects and contact links."
        }
    };

    const TIME_PERIODS = [
        {
            key: "morning",
            start: 5,
            end: 11,
            icon: "ri-sun-foggy-line",
            greeting: { "zh-CN": "早上好", "zh-TW": "早安", "en": "Good morning" }
        },
        {
            key: "midday",
            start: 11,
            end: 14,
            icon: "ri-sun-line",
            greeting: { "zh-CN": "中午好", "zh-TW": "午安", "en": "Good afternoon" }
        },
        {
            key: "afternoon",
            start: 14,
            end: 18,
            icon: "ri-sun-cloudy-line",
            greeting: { "zh-CN": "下午好", "zh-TW": "午安", "en": "Good afternoon" }
        },
        {
            key: "evening",
            start: 18,
            end: 22,
            icon: "ri-sunset-line",
            greeting: { "zh-CN": "晚上好", "zh-TW": "晚上好", "en": "Good evening" }
        },
        {
            key: "night",
            start: 22,
            end: 29,
            icon: "ri-moon-clear-line",
            greeting: { "zh-CN": "夜深了", "zh-TW": "夜深了", "en": "Good night" }
        }
    ];

    let currentLanguage = "zh-CN";
    let currentThemeMode = "auto";
    let themeTransitionTimer = null;
    let translatableTextNodes = [];
    let translatableAttributes = [];

    function translateCopy(source, language = currentLanguage) {
        const copy = UI_COPY[source];
        if (!copy || language === "zh-CN") return source;
        return copy[language] || source;
    }

    function captureTranslatableContent() {
        const textNodes = [];
        document.body.querySelectorAll("*").forEach((element) => {
            if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) return;
            if (element.id === "modal-title") return;

            element.childNodes.forEach((node) => {
                if (node.nodeType !== 3) return;
                const source = node.nodeValue.trim();
                if (!source || !UI_COPY[source]) return;

                const leading = node.nodeValue.match(/^\s*/)?.[0] || "";
                const trailing = node.nodeValue.match(/\s*$/)?.[0] || "";
                textNodes.push({ node, source, leading, trailing });
            });
        });

        const attributes = [];
        document.querySelectorAll("[aria-label], [alt], [title], [placeholder]").forEach((element) => {
            ["aria-label", "alt", "title", "placeholder"].forEach((attribute) => {
                const source = element.getAttribute(attribute);
                if (source && UI_COPY[source]) {
                    attributes.push({ element, attribute, source });
                }
            });
        });

        translatableTextNodes = textNodes;
        translatableAttributes = attributes;
    }

    function updatePageMeta(language) {
        const meta = PAGE_META[language] || PAGE_META["zh-CN"];
        document.title = meta.title;

        [
            'meta[name="description"]',
            'meta[property="og:description"]',
            'meta[name="twitter:description"]'
        ].forEach((selector) => {
            const element = document.querySelector(selector);
            if (element) element.setAttribute("content", meta.description);
        });

        ['meta[property="og:title"]', 'meta[name="twitter:title"]'].forEach((selector) => {
            const element = document.querySelector(selector);
            if (element) element.setAttribute("content", meta.title);
        });
    }

    function applyLanguage(language, persist = true) {
        const nextLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : "zh-CN";
        currentLanguage = nextLanguage;
        document.documentElement.lang = nextLanguage;
        document.documentElement.dataset.language = nextLanguage;

        translatableTextNodes.forEach(({ node, source, leading, trailing }) => {
            node.nodeValue = leading + translateCopy(source, nextLanguage) + trailing;
        });

        translatableAttributes.forEach(({ element, attribute, source }) => {
            element.setAttribute(attribute, translateCopy(source, nextLanguage));
        });

        document.querySelectorAll(".lang-item[data-lang]").forEach((button) => {
            const active = button.dataset.lang === nextLanguage;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        const contactModal = document.getElementById("contact-modal");
        const contactModalTitle = document.getElementById("modal-title");
        if (contactModalTitle && !contactModal?.classList.contains("active")) {
            contactModalTitle.textContent = translateCopy("联系方式", nextLanguage);
        }

        const themeStatus = document.getElementById("themeStatus");
        if (themeStatus) themeStatus.textContent = "";

        updatePageMeta(nextLanguage);
        updateClockAndTheme();

        if (persist) {
            try {
                localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
            } catch (error) {
                console.warn("Language preference could not be saved:", error);
            }
        }
    }

    function initLanguage() {
        captureTranslatableContent();

        let storedLanguage = "zh-CN";
        try {
            const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
            if (saved && SUPPORTED_LANGUAGES.includes(saved)) storedLanguage = saved;
        } catch (error) {
            console.warn("Language preference could not be read:", error);
        }

        applyLanguage(storedLanguage, false);

        document.querySelectorAll(".lang-item[data-lang]").forEach((button) => {
            button.addEventListener("click", () => {
                applyLanguage(button.dataset.lang || "zh-CN");
            });
        });
    }

    function getThemeCopy() {
        return THEME_COPY[currentLanguage] || THEME_COPY["zh-CN"];
    }

    function updateThemeControl(announce = false) {
        const button = document.getElementById("themeToggle");
        const status = document.getElementById("themeStatus");
        const copy = getThemeCopy();

        if (button) {
            const resolvedTheme = document.documentElement.dataset.resolvedTheme || "dark";
            const labelKey = currentThemeMode === "auto"
                ? (resolvedTheme === "light" ? "autoToDark" : "autoToLight")
                : currentThemeMode;
            const label = copy.labels[labelKey];
            const icon = button.querySelector("i");
            button.dataset.themeMode = currentThemeMode;
            button.setAttribute("aria-label", label);
            button.setAttribute("title", label);
            if (icon) icon.className = THEME_ICONS[currentThemeMode];
        }

        if (announce && status) {
            status.textContent = copy.status[currentThemeMode];
        }
    }

    function applyThemeForHour(hour, announce = false) {
        const isLight = currentThemeMode === "light" ||
            (currentThemeMode === "auto" && hour >= 7 && hour < 19);
        const root = document.documentElement;

        root.classList.toggle("light", isLight);
        root.dataset.themeMode = currentThemeMode;
        root.dataset.resolvedTheme = isLight ? "light" : "dark";

        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) {
            themeColor.setAttribute("content", isLight ? "#EDF3FC" : "#07101F");
        }

        updateThemeControl(announce);
    }

    function setThemeMode(mode, { persist = true, announce = false, animate = false } = {}) {
        const nextMode = THEME_MODES.includes(mode) ? mode : "auto";
        const root = document.documentElement;
        const button = document.getElementById("themeToggle");
        currentThemeMode = nextMode;

        if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            root.classList.add("theme-changing");
            button?.classList.add("is-switching");
            if (themeTransitionTimer) window.clearTimeout(themeTransitionTimer);
            themeTransitionTimer = window.setTimeout(() => {
                root.classList.remove("theme-changing");
                button?.classList.remove("is-switching");
            }, 480);
        }

        updateClockAndTheme(announce);

        if (persist) {
            try {
                localStorage.setItem(THEME_STORAGE_KEY, nextMode);
            } catch (error) {
                console.warn("Theme preference could not be saved:", error);
            }
        }
    }

    function initTheme() {
        let storedTheme = document.documentElement.dataset.themeMode || "auto";

        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            if (saved && THEME_MODES.includes(saved)) storedTheme = saved;
        } catch (error) {
            console.warn("Theme preference could not be read:", error);
        }

        currentThemeMode = THEME_MODES.includes(storedTheme) ? storedTheme : "auto";
        updateThemeControl(false);

        const button = document.getElementById("themeToggle");
        if (button) {
            button.addEventListener("click", () => {
                const resolvedTheme = document.documentElement.dataset.resolvedTheme || "dark";
                const nextMode = currentThemeMode === "auto"
                    ? (resolvedTheme === "light" ? "dark" : "light")
                    : (currentThemeMode === "light" ? "dark" : "auto");
                setThemeMode(nextMode, { persist: true, announce: true, animate: true });
            });
        }
    }

    function getTimePeriod(hour) {
        const normalizedHour = hour < 5 ? hour + 24 : hour;
        return TIME_PERIODS.find((period) =>
            normalizedHour >= period.start && normalizedHour < period.end
        ) || TIME_PERIODS[4];
    }

    // --- 1. 时钟、昼夜状态与主题控制 ---
    function updateClockAndTheme(announceTheme = false) {
        const now = new Date();
        const locale = LANGUAGE_LOCALES[currentLanguage] || "zh-CN";
        const hour = now.getHours();
        const period = getTimePeriod(hour);
        const greeting = period.greeting[currentLanguage] || period.greeting["zh-CN"];
        const clockElement = document.getElementById("clock");

        if (clockElement) {
            const timeString = now.toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: currentLanguage === "en"
            });
            clockElement.textContent = timeString;
            clockElement.setAttribute("datetime", now.toISOString());
        }

        const dateString = new Intl.DateTimeFormat(locale, {
            month: "long",
            day: "numeric",
            weekday: "long"
        }).format(now);

        const greetingElement = document.getElementById("timeGreeting");
        const dateElement = document.getElementById("timeDate");
        const iconElement = document.getElementById("timeIcon");
        const widget = document.getElementById("timeWidget");

        if (greetingElement) greetingElement.textContent = greeting;
        if (dateElement) dateElement.textContent = dateString;
        if (iconElement) iconElement.className = period.icon;

        if (widget) {
            const minutesSinceMidnight = hour * 60 + now.getMinutes();
            const progress = (minutesSinceMidnight / (24 * 60)) * 360;
            widget.dataset.period = period.key;
            widget.style.setProperty("--time-progress", progress.toFixed(2) + "deg");

            const timeText = clockElement?.textContent || "";
            if (currentLanguage === "en") {
                widget.setAttribute("aria-label", greeting + ". Local time " + timeText + ", " + dateString + ".");
            } else if (currentLanguage === "zh-TW") {
                widget.setAttribute("aria-label", greeting + "，目前時間 " + timeText + "，" + dateString);
            } else {
                widget.setAttribute("aria-label", greeting + "，当前时间 " + timeText + "，" + dateString);
            }
        }

        applyThemeForHour(hour, announceTheme);
    }

    // --- 2. 导航栏滚动与响应式交互 ---
    function initNavbar() {
        const nav = document.querySelector(".tencent-nav");
        const navToggle = document.getElementById("navToggle");
        const navMenu = document.getElementById("navMenu");
        
        if (nav) {
            let ticking = false;
            const updateNavState = () => {
                ticking = false;
                if (window.scrollY > 50) {
                    nav.classList.add("scrolled");
                } else {
                    nav.classList.remove("scrolled");
                }
            };
            // rAF 节流 + passive：避免每帧触发 classList 操作导致滚动掉帧
            window.addEventListener("scroll", () => {
                if (!ticking) {
                    ticking = true;
                    window.requestAnimationFrame(updateNavState);
                }
            }, { passive: true });
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
            slides.forEach(slide => {
                slide.classList.remove("active");
                slide.setAttribute("aria-hidden", "true");
            });
            dots.forEach(dot => {
                dot.classList.remove("active");
                dot.setAttribute("aria-current", "false");
            });

            currentIndex = (index + slides.length) % slides.length;
            slides[currentIndex].classList.add("active");
            slides[currentIndex].setAttribute("aria-hidden", "false");
            
            if (dots[currentIndex]) {
                dots[currentIndex].classList.add("active");
                dots[currentIndex].setAttribute("aria-current", "true");
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
            carousel.addEventListener("focusin", stopAutoPlay);
            carousel.addEventListener("focusout", (event) => {
                if (!carousel.contains(event.relatedTarget)) {
                    startAutoPlay();
                }
            });

            // 页面切到后台时暂停轮播，切回时恢复：避免后台无意义动画
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    stopAutoPlay();
                } else {
                    startAutoPlay();
                }
            });

            // 移动端触摸横向滑动切换
            let touchStartX = 0;
            let touchStartY = 0;
            const touchThreshold = 48;
            carousel.addEventListener("touchstart", (event) => {
                const touch = event.touches[0];
                if (!touch) return;
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
            }, { passive: true });
            carousel.addEventListener("touchend", (event) => {
                const touch = event.changedTouches[0];
                if (!touch) return;
                const deltaX = touch.clientX - touchStartX;
                const deltaY = touch.clientY - touchStartY;
                if (Math.abs(deltaX) > touchThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
                    if (deltaX < 0) {
                        nextSlide();
                    } else {
                        prevSlide();
                    }
                    startAutoPlay();
                }
            }, { passive: true });
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
                    button.dataset.contactTitle || translateCopy("联系方式"),
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

        // 仅在 IntersectionObserver 不可用时兜底；可用时完全交给 Observer，避免 1.5s 强拉导致的进度条闪跳
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
        initTheme();
        initLanguage();
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