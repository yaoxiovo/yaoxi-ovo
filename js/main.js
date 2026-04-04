// ==================== 社交媒体模块加载（延迟至空闲时） ====================
var _marqueeLoaded = false;
function _loadMarquee() {
    if (_marqueeLoaded) return;
    _marqueeLoaded = true;
    fetch('APP/index.html').then(function(r) { return r.text(); }).catch(function() { return ''; }).then(function(html) {
        if (!html) return;
        var container = document.getElementById('appMarquee');
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        doc.querySelectorAll('script').forEach(function(s) { s.remove(); });
        doc.querySelectorAll('*').forEach(function(el) {
            [...el.attributes].forEach(function(attr) {
                if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
            });
        });
        container.innerHTML = doc.body.innerHTML;
    });
}
if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(_loadMarquee, { timeout: 3000 });
} else {
    setTimeout(_loadMarquee, 1500);
}

// ==================== 像素横幅渲染 ====================
var _pixelAnimationId = null;
var _pixelObserver = null;

function renderPixelBanner(text) {
    if (_pixelAnimationId) {
        cancelAnimationFrame(_pixelAnimationId);
        _pixelAnimationId = null;
    }
    if (_pixelObserver) {
        _pixelObserver.disconnect();
        _pixelObserver = null;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grid = document.getElementById('pixelGrid');

    const containerWidth = grid.parentElement.clientWidth || 420;
    const baseGap = 1;
    var cols, rows, cellSize;

    if (containerWidth < 500) {
        cellSize = 4;
        cols = Math.floor((containerWidth + baseGap) / (cellSize + baseGap));
        cols = Math.max(35, Math.min(cols, 65));
        rows = 14;
    } else {
        var baseCols = 70;
        cellSize = Math.floor((containerWidth + baseGap) / baseCols) - baseGap;
        cellSize = Math.max(3, Math.min(cellSize, 6));
        cols = baseCols;
        rows = 16;
    }

    var gridTotalW = cols * cellSize + (cols - 1) * baseGap;
    while (gridTotalW > containerWidth && cols > 35) {
        cols--;
        gridTotalW = cols * cellSize + (cols - 1) * baseGap;
    }

    if (cellSize <= 3) rows = 12;
    else if (cellSize <= 4) rows = Math.min(rows, 14);

    const textCanvas = document.createElement('canvas');
    textCanvas.width = cols;
    textCanvas.height = rows;
    const tctx = textCanvas.getContext('2d');
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, cols, rows);
    tctx.fillStyle = '#fff';
    var fontSize = rows <= 12 ? 11 : (rows <= 14 ? 12 : 14);
    var fontWeight = containerWidth < 500 ? '100' : '100';
    tctx.font = 'italic ' + fontWeight + ' ' + fontSize + 'px "Microsoft YaHei", "PingFang SC", sans-serif';
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    tctx.letterSpacing = '8px';
    const spacing = -5;
    const totalWidth = tctx.measureText(text).width + spacing * (text.length - 1);
    let x = (cols - totalWidth) / 2;
    for (const ch of text) {
        const w = tctx.measureText(ch).width;
        tctx.fillText(ch, x + w / 2 + 3, rows / 2);
        x += w + spacing;
    }
    var imageData = tctx.getImageData(0, 0, cols, rows);

    var topRow = rows, bottomRow = 0;
    for (var sr = 0; sr < rows; sr++) {
        for (var sc = 0; sc < cols; sc++) {
            if (imageData.data[(sr * cols + sc) * 4] > 80) {
                if (sr < topRow) topRow = sr;
                if (sr > bottomRow) bottomRow = sr;
            }
        }
    }
    if (topRow <= bottomRow) {
        var textHeight = bottomRow - topRow + 1;
        var idealTop = Math.floor((rows - textHeight) / 2);
        idealTop = Math.max(1, Math.min(idealTop, rows - textHeight - 1));
        var shift = idealTop - topRow;
        if (shift !== 0) {
            var oldData = new Uint8ClampedArray(imageData.data);
            imageData.data.fill(0);
            for (var sr2 = 0; sr2 < rows; sr2++) {
                var dstRow = sr2 + shift;
                if (dstRow < 0 || dstRow >= rows) continue;
                for (var sc2 = 0; sc2 < cols; sc2++) {
                    var srcIdx = (sr2 * cols + sc2) * 4;
                    var dstIdx = (dstRow * cols + sc2) * 4;
                    imageData.data[dstIdx]     = oldData[srcIdx];
                    imageData.data[dstIdx + 1] = oldData[srcIdx + 1];
                    imageData.data[dstIdx + 2] = oldData[srcIdx + 2];
                    imageData.data[dstIdx + 3] = oldData[srcIdx + 3];
                }
            }
        }
    }

    grid.innerHTML = '';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', ' + cellSize + 'px)';
    grid.style.gap = baseGap + 'px';

    var activePixels = [];
    var frag = document.createDocumentFragment();
    for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
            var idx = (r * cols + c) * 4;
            var el = document.createElement('div');
            el.style.cssText = 'width:' + cellSize + 'px;height:' + cellSize + 'px;border-radius:1px';
            if (imageData.data[idx] > 80) {
                el.className = 'pixel-active';
                activePixels.push({ el: el, c: c });
            } else {
                el.style.background = 'rgba(255,255,255,0.1)';
            }
            frag.appendChild(el);
        }
    }
    grid.appendChild(frag);

    if (prefersReducedMotion) {
        for (var i = 0; i < activePixels.length; i++) {
            activePixels[i].el.style.background = 'hsl(200,80%,60%)';
        }
        return;
    }

    var offset = 0;
    function animate() {
        for (var i = 0; i < activePixels.length; i++) {
            var p = activePixels[i];
            var hue = ((p.c / cols) * 300 + offset) % 360;
            if (hue < 0) hue += 360;
            p.el.style.background = 'hsl(' + hue + ',80%,60%)';
        }
        offset -= 0.4;
        _pixelAnimationId = requestAnimationFrame(animate);
    }

    _pixelObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                if (!_pixelAnimationId) animate();
            } else {
                if (_pixelAnimationId) {
                    cancelAnimationFrame(_pixelAnimationId);
                    _pixelAnimationId = null;
                }
            }
        });
    }, { threshold: 0.1 });

    _pixelObserver.observe(grid.parentElement);
}

// 像素横幅初始文字由后台 get_content 决定，此处不提前渲染
// 避免移动端 resize 事件用硬编码文字覆盖后台设置
var _pixelResizeTimer;
var _lastPixelText = '我爱雨云'; // 兜底默认值，get_content 成功后会被覆盖
var _pixelTextReady = false;    // 标记后台文字是否已就绪
window.addEventListener('resize', function() {
    clearTimeout(_pixelResizeTimer);
    _pixelResizeTimer = setTimeout(function() {
        renderPixelBanner(_lastPixelText);// 文字内容不变，强制重渲染以适应新尺寸
    }, 200);
});

// ==================== 主逻辑（内容加载、邮件、导航、帖子、回复） ====================
(function () {
    const iconSVG = {
        globe:   '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        code:    '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        layout:  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
        sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z"/></svg>',
        server:  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
        palette: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
        terminal:'<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
        book:    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
    };

    var _escDiv = document.createElement('div');
    function esc(str) { _escDiv.textContent = str; return _escDiv.innerHTML; }
    var _projectLinkConfirmEnabled = false;
    var _projectPendingUrl = '';
    var projectConfirmOverlay = document.getElementById('projectConfirmOverlay');
    var projectConfirmUrl = document.getElementById('projectConfirmUrl');
    var projectConfirmCancel = document.getElementById('projectConfirmCancel');
    var projectConfirmOk = document.getElementById('projectConfirmOk');

    function normalizeProjectUrl(url) {
        var s = (url || '').trim();
        if (!/^https?:\/\//i.test(s)) return '';
        try {
            var u = new URL(s, window.location.href);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
            return u.href;
        } catch (e) {
            return '';
        }
    }

    function closeProjectConfirm() {
        _projectPendingUrl = '';
        if (projectConfirmOverlay) {
            projectConfirmOverlay.classList.remove('show');
            projectConfirmOverlay.setAttribute('aria-hidden', 'true');
        }
    }

    function openProjectConfirm(url) {
        if (!projectConfirmOverlay || !projectConfirmUrl) {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }
        _projectPendingUrl = url;
        projectConfirmUrl.textContent = url;
        projectConfirmOverlay.classList.add('show');
        projectConfirmOverlay.setAttribute('aria-hidden', 'false');
    }

    function sendTrackVisit() {
        fetch('admin/api.php?action=track_visit', { method: 'POST', keepalive: true }).catch(function() {});
    }
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(sendTrackVisit, { timeout: 2000 });
    } else {
        setTimeout(sendTrackVisit, 1200);
    }

    // 自动跑路检测
    fetch('admin/api.php?action=check_nuke')
        .then(r => r.json())
        .then(res => {
            if (res.success && res.nuked) {
                if (res.redirect_url) {
                    window.location.href = res.redirect_url;
                } else {
                    document.body.innerHTML =
                        '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#181c21;color:#fff;font-family:sans-serif;">' +
                        '<div style="text-align:center;padding:40px;">' +
                        '<div style="font-size:48px;margin-bottom:16px;">&#128075;</div>' +
                        '<h1 style="font-size:28px;margin-bottom:8px;">再见！</h1>' +
                        '<p style="color:rgba(255,255,255,0.5);font-size:14px;">网站已自动清空。</p>' +
                        '</div></div>';
                }
                throw new Error('nuked');
            }
        })
        .catch(() => {});

    // 从后端加载动态内容
    fetch('admin/api.php?action=get_content')
        .then(r => r.json())
        .then(res => {
            if (!res.success || !res.data) return;
            const d = res.data;

            const annBar = document.getElementById('announcementBar');
            const annLink = document.getElementById('announcementLinkEl');
            const annText = document.getElementById('announcementTextEl');
            if (annBar && annLink && annText) {
                const ann = d.announcement || {};
                const annEnabled = !!ann.enabled && !!ann.text;
                if (annEnabled) {
                    annText.textContent = ann.text;
                    annLink.href = (/^https?:\/\//i.test(ann.link || '') ? ann.link : '#');
                    annLink.target = ann.link ? '_blank' : '_self';
                    annLink.rel = ann.link ? 'noopener noreferrer' : '';
                    annBar.style.display = '';
                } else {
                    annBar.style.display = 'none';
                }
            }

            // 背景设置
            const bgMode = d.bg_mode || 'default';
            const bgBlur = d.bg_blur ?? 6;
            const bgOpacity = d.bg_opacity ?? 70;

            const bgBlurEl = document.querySelector('.bg-blur');
            if (bgBlurEl) {
                bgBlurEl.style.backdropFilter = 'blur(' + bgBlur + 'px)';
                bgBlurEl.style.webkitBackdropFilter = 'blur(' + bgBlur + 'px)';
            }

            if (bgMode === 'image' && d.bg_image) {
                const bgEl = document.querySelector('.bg');
                if (bgEl) {
                    bgEl.innerHTML = '';
                    bgEl.style.backgroundImage = 'url(' + d.bg_image + ')';
                    bgEl.style.backgroundSize = 'cover';
                    bgEl.style.backgroundPosition = 'center';
                    bgEl.style.backgroundRepeat = 'no-repeat';
                }
                if (bgBlurEl) {
                    bgBlurEl.style.background = 'rgba(24, 28, 33, ' + (bgOpacity / 100) + ')';
                }
            } else {
                if (bgOpacity != 70 && bgBlurEl) {
                    bgBlurEl.style.background = 'rgba(24, 28, 33, ' + (bgOpacity / 100 * 0.3) + ')';
                }
            }

            // 头像
            if (d.avatar) {
                document.querySelectorAll('.avatar, .mobile-avatar').forEach(function(avatarEl) {
                    const placeholder = avatarEl.querySelector('.avatar-placeholder');
                    if (placeholder) placeholder.style.display = 'none';
                    const existImg = avatarEl.querySelector('.avatar-img');
                    if (existImg) existImg.remove();
                    const img = document.createElement('img');
                    img.className = 'avatar-img';
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.src = d.avatar;
                    img.alt = '头像';
                    avatarEl.appendChild(img);
                });
            }

            // 标题
            const tp = document.querySelector('.title-prefix');
            const tt = document.querySelector('.title');
            if (tp && d.title_prefix) tp.textContent = d.title_prefix;
            if (tt && d.title) tt.textContent = d.title;

            // 副标题
            const sp = document.querySelector('.subtitle-prefix');
            const sn = document.querySelector('.subtitle-name');
            if (sp && d.subtitle_prefix) sp.textContent = d.subtitle_prefix;
            if (sn && d.subtitle_name) sn.textContent = d.subtitle_name;

            // 渐变色
            if (d.gradient_colors && d.gradient_colors.length >= 2) {
                const gradColors = d.gradient_colors.join(', ');
                const gradCSS = 'linear-gradient(135deg, ' + gradColors + ')';
                const animate = d.gradient_animate !== false;
                [tt, sn].forEach(el => {
                    if (!el) return;
                    el.style.background = gradCSS;
                    el.style.webkitBackgroundClip = 'text';
                    el.style.webkitTextFillColor = 'transparent';
                    el.style.backgroundClip = 'text';
                    if (animate) {
                        el.style.backgroundSize = '200% 200%';
                        el.style.animation = 'gradientText 4s ease infinite';
                    } else {
                        el.style.backgroundSize = '100% 100%';
                        el.style.animation = 'none';
                    }
                });
            }

            // 像素文字
            if (d.pixel_text) {
                _lastPixelText = d.pixel_text;
            }
            _pixelTextReady = true;
            renderPixelBanner(_lastPixelText);

            // 个人简介
            const introEl = document.querySelector('.intro-text');
            if (introEl && d.intro) introEl.textContent = d.intro;

            // 技能
            if (d.skills && d.skills.length > 0) {
                const sg = document.querySelector('.skills-grid');
                if (sg) {
                    sg.innerHTML = d.skills.map(s => '<span class="skill-tag">' + esc(s) + '</span>').join('');
                }
            }

            // 项目
            if (d.projects && d.projects.length > 0) {
                const pg = document.querySelector('.projects-grid');
                if (pg) {
                    pg.innerHTML = d.projects.map(p => {
                        const icon = iconSVG[p.icon] || iconSVG.globe;
                        const inner =
                            '<div class="project-icon">' + icon + '</div>' +
                            '<div class="project-title">' + esc(p.title) + '</div>' +
                            '<div class="project-desc">' + esc(p.desc) + '</div>';
                        if (p.link) {
                            var projectUrl = normalizeProjectUrl(p.link);
                            if (projectUrl) {
                                return '<a class="project-item project-link" data-project-url="' + esc(projectUrl) + '" href="' + esc(projectUrl) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
                            }
                        }
                        return '<div class="project-item">' + inner + '</div>';
                    }).join('');
                }
            }

            // 联系方式
            if (d.contact) {
                const ci = document.querySelectorAll('.contact-item');
                if (ci[0] && d.contact.qq)     ci[0].innerHTML = ci[0].querySelector('svg').outerHTML + ' QQ: ' + esc(d.contact.qq);
                if (ci[1] && d.contact.wechat) ci[1].innerHTML = ci[1].querySelector('svg').outerHTML + ' WeChat: ' + esc(d.contact.wechat);
                if (ci[2] && d.contact.email)  ci[2].innerHTML = ci[2].querySelector('svg').outerHTML + ' Email: ' + esc(d.contact.email);
                if (ci[3] && d.contact.github) ci[3].innerHTML = ci[3].querySelector('svg').outerHTML + ' GitHub: ' + esc(d.contact.github);
            }

            // 终端展示
            const terminalCard = document.getElementById('terminalCard');
            const terminalTitleEl = document.getElementById('terminalTitle');
            const terminalBody = document.getElementById('terminalBody');
            if (d.terminal && d.terminal.enabled !== false) {
                if (terminalCard) terminalCard.style.display = '';
                if (terminalTitleEl && d.terminal.title) terminalTitleEl.textContent = d.terminal.title;
                if (terminalBody && d.terminal.commands && d.terminal.commands.length > 0) {
                    terminalBody.innerHTML = d.terminal.commands.map(cmd => {
                        const cls = cmd.type === 'command' ? 'terminal-command' : (cmd.type === 'prompt' ? 'terminal-prompt' : 'terminal-output');
                        return '<p class="' + cls + '">' + esc(cmd.content) + '</p>';
                    }).join('');
                }
            } else {
                if (terminalCard) terminalCard.style.display = 'none';
            }

            // 音乐播放器开关
            if (d.music_player && d.music_player.enabled === false) {
                window.__musicPlayerDisabled = true;
            }

            // 帖子模块开关
            _postsEnabled = (d.posts_enabled === true);
            _projectLinkConfirmEnabled = (d.project_link_confirm === true);
        })
        .catch(function() {
            // get_content 失败时乐观启用帖子，由 loadPosts 自行决定是否显示
            _postsEnabled = true;
            // 像素横幅用默认文字兜底渲染
            if (!_pixelTextReady) {
                _pixelTextReady = true;
                renderPixelBanner(_lastPixelText);
            }
        })
        .finally(function() {
            document.querySelector('.main-content').classList.add('loaded');
            loadPosts();
        });

    var projectsGrid = document.querySelector('.projects-grid');
    if (projectsGrid) {
        projectsGrid.addEventListener('click', function (e) {
            var link = e.target.closest('a.project-link');
            if (!link) return;
            if (!_projectLinkConfirmEnabled) return;
            var url = normalizeProjectUrl(link.getAttribute('data-project-url') || link.getAttribute('href'));
            if (!url) return;
            e.preventDefault();
            openProjectConfirm(url);
        });
    }

    if (projectConfirmCancel) {
        projectConfirmCancel.addEventListener('click', closeProjectConfirm);
    }
    if (projectConfirmOverlay) {
        projectConfirmOverlay.addEventListener('click', function (e) {
            if (e.target === projectConfirmOverlay) closeProjectConfirm();
        });
    }
    if (projectConfirmOk) {
        projectConfirmOk.addEventListener('click', function () {
            if (!_projectPendingUrl) return;
            var url = _projectPendingUrl;
            closeProjectConfirm();
            window.open(url, '_blank', 'noopener,noreferrer');
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && projectConfirmOverlay && projectConfirmOverlay.classList.contains('show')) {
            closeProjectConfirm();
        }
    });

    // 兜底：API 超过 1.5 秒没响应也显示页面
    setTimeout(function() {
        document.querySelector('.main-content').classList.add('loaded');
    }, 1500);

    // ========== 邮件表单 — 图片上传 ==========
    var emailImageFile = document.getElementById('emailImageFile');
    var emailImageUpload = document.getElementById('emailImageUpload');
    var emailImagePlaceholder = document.getElementById('emailImagePlaceholder');
    var emailImagePreview = document.getElementById('emailImagePreview');
    var emailImagePreviewImg = document.getElementById('emailImagePreviewImg');
    var emailImageRemove = document.getElementById('emailImageRemove');
    var _pendingImageFile = null;
    var _pendingBlobUrl = '';

    if (emailImagePlaceholder) {
        emailImagePlaceholder.addEventListener('click', function () { emailImageFile.click(); });
    }

    if (emailImageUpload) {
        emailImageUpload.addEventListener('dragover', function (e) { e.preventDefault(); this.classList.add('dragover'); });
        emailImageUpload.addEventListener('dragleave', function () { this.classList.remove('dragover'); });
        emailImageUpload.addEventListener('drop', function (e) {
            e.preventDefault();
            this.classList.remove('dragover');
            var file = e.dataTransfer.files[0];
            if (file) handleEmailImage(file);
        });
    }

    if (emailImageFile) {
        emailImageFile.addEventListener('change', function () {
            if (this.files[0]) handleEmailImage(this.files[0]);
        });
    }

    function _clearPendingImage() {
        if (_pendingBlobUrl) { URL.revokeObjectURL(_pendingBlobUrl); _pendingBlobUrl = ''; }
        _pendingImageFile = null;
        if (emailImagePreviewImg) emailImagePreviewImg.src = '';
        if (emailImagePreview) emailImagePreview.style.display = 'none';
        if (emailImagePlaceholder) emailImagePlaceholder.style.display = '';
        if (emailImageFile) emailImageFile.value = '';
    }

    function _readFileAsDataURL(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) { resolve(e.target.result); };
            reader.onerror = function() { reject(new Error('读取文件失败')); };
            reader.readAsDataURL(file);
        });
    }

    function handleEmailImage(file) {
        if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
            alert('仅支持 JPG/PNG/GIF/WebP 格式');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('图片不能超过 2MB');
            return;
        }
        if (_pendingBlobUrl) URL.revokeObjectURL(_pendingBlobUrl);
        _pendingImageFile = file;
        _pendingBlobUrl = URL.createObjectURL(file);
        emailImagePreviewImg.src = _pendingBlobUrl;
        emailImagePreview.style.display = '';
        emailImagePlaceholder.style.display = 'none';
    }

    if (emailImageRemove) {
        emailImageRemove.addEventListener('click', function (e) {
            e.stopPropagation();
            _clearPendingImage();
        });
    }

    // ========== 邮件表单 — 提交 ==========
    const form = document.getElementById('emailReplyForm');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const name    = (form.querySelector('[name="name"]').value || '').trim();
            const email   = (form.querySelector('[name="from"]').value || '').trim();
            const message = (form.querySelector('[name="message"]').value || '').trim();

            if (!name || !email || !message) {
                alert('请填写完整信息');
                return;
            }

            const btn = form.querySelector('.email-submit');
            const origText = btn.textContent;
            btn.textContent = '发送中...';
            btn.disabled = true;

            var doSubmit = function(imageDataUrl) {
                var payload = { name: name, email: email, message: message };
                if (imageDataUrl) payload.image = imageDataUrl;

                fetch('admin/api.php?action=save_message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(r => r.json())
                .then(res => {
                    btn.textContent = origText;
                    btn.disabled = false;
                    payload = null;
                    if (res.success) {
                        alert(res.message || '留言发送成功！');
                        form.reset();
                        _clearPendingImage();
                    } else {
                        alert(res.message || '发送失败，请重试');
                    }
                })
                .catch(() => {
                    btn.textContent = origText;
                    btn.disabled = false;
                    alert('网络错误，请稍后重试');
                });
            };

            if (_pendingImageFile) {
                _readFileAsDataURL(_pendingImageFile).then(doSubmit).catch(function() {
                    btn.textContent = origText;
                    btn.disabled = false;
                    alert('图片读取失败，请重试');
                });
            } else {
                doSubmit('');
            }
        });
    }

    // ========== 导航滚动 ==========
    const navMap = {
        'nav-about': 'about',
        'nav-skills': 'skills',
        'nav-projects': 'projects',
        'nav-posts': 'posts',
        'nav-contact': 'contact'
    };
    document.querySelectorAll('.radio-container input[name="nav"]').forEach(function(radio) {
        radio.addEventListener('change', function() {
            const targetId = navMap[this.id];
            const el = targetId && document.getElementById(targetId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    document.querySelectorAll('.glass-radio-group input').forEach(function(radio) {
        radio.addEventListener('change', function() {
            var el = document.getElementById('contact');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // ========== 帖子模块 ==========
    var _postsSig = '';
    var _postsEtag = '';
    var _postsAbort = null;
    var _postsEnabled = false;

    var _postLb = null;
    var _postLbCover = null;
    var _postLbTitle = null;
    var _postLbSubtitle = null;
    var _postLbContent = null;
    var _postLbClose = null;
    var _postLbKeyHandler = null;

    function initPostLightbox() {
        if (_postLb) return;
        var lb = document.createElement('div');
        lb.className = 'post-lightbox';
        lb.setAttribute('role', 'dialog');
        lb.setAttribute('aria-modal', 'true');
        lb.innerHTML =
            '<div class="post-lightbox-dialog" role="document">' +
                '<div class="post-lightbox-header">' +
                    '<div class="post-lightbox-headtext">' +
                        '<h3 class="post-lightbox-title"></h3>' +
                        '<p class="post-lightbox-subtitle"></p>' +
                    '</div>' +
                    '<button type="button" class="post-lightbox-close" aria-label="关闭">×</button>' +
                '</div>' +
                '<div class="post-lightbox-body">' +
                    '<img class="post-lightbox-cover" alt="封面">' +
                    '<div class="post-lightbox-content"></div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(lb);
        _postLb = lb;
        _postLbCover = lb.querySelector('.post-lightbox-cover');
        _postLbTitle = lb.querySelector('.post-lightbox-title');
        _postLbSubtitle = lb.querySelector('.post-lightbox-subtitle');
        _postLbContent = lb.querySelector('.post-lightbox-content');
        _postLbClose = lb.querySelector('.post-lightbox-close');

        lb.addEventListener('click', function(e) {
            if (e.target === lb) closePostLightbox();
        });
        if (_postLbClose) _postLbClose.addEventListener('click', closePostLightbox);
    }

    function openPostLightbox(post) {
        initPostLightbox();
        if (!_postLb || !_postLbTitle || !_postLbSubtitle || !_postLbContent) return;

        _postLbTitle.textContent = (post && post.title) ? String(post.title) : '无标题';
        var sub = (post && post.subtitle) ? String(post.subtitle) : '';
        _postLbSubtitle.textContent = sub;
        _postLbSubtitle.style.display = sub ? '' : 'none';

        if (_postLbCover) {
            if (post && post.cover) {
                _postLbCover.src = String(post.cover);
                _postLbCover.style.display = '';
            } else {
                _postLbCover.src = '';
                _postLbCover.style.display = 'none';
            }
        }

        _postLbContent.innerHTML = (post && post.content) ? String(post.content) : '<p style="opacity:.7;margin:0;">暂无内容</p>';
        _postLbContent.querySelectorAll('a').forEach(function(a) {
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
        });
        _postLbContent.querySelectorAll('img').forEach(function(img) {
            img.style.cursor = 'pointer';
            img.addEventListener('click', function(e) {
                e.stopPropagation();
                var src = img.src || img.getAttribute('data-src');
                if (src) openLightbox(src);
            });
        });

        _postLb.classList.add('show');
        document.documentElement.style.overflow = 'hidden';

        if (_postLbKeyHandler) {
            document.removeEventListener('keydown', _postLbKeyHandler);
        }
        _postLbKeyHandler = function(e) {
            if (e.key === 'Escape') closePostLightbox();
        };
        document.addEventListener('keydown', _postLbKeyHandler);

        if (_postLbClose) _postLbClose.focus();
    }

    function closePostLightbox() {
        if (!_postLb) return;
        _postLb.classList.remove('show');
        document.documentElement.style.overflow = '';
        if (_postLbKeyHandler) {
            document.removeEventListener('keydown', _postLbKeyHandler);
            _postLbKeyHandler = null;
        }
    }

    function loadPosts() {
        var container = document.getElementById('postsGrid');
        var postsCard = document.getElementById('posts');
        var navPostsInput = document.getElementById('nav-posts');
        var navPostsLabel = null;
        if (navPostsInput) {
            navPostsLabel = document.querySelector('label[for="nav-posts"]');
        }
        if (!container) return;

        var navWrap = document.querySelector('.radio-container');
        if (navWrap) navWrap.style.setProperty('--total-radio', _postsEnabled ? '5' : '4');

        if (!_postsEnabled) {
            if (postsCard) postsCard.style.display = 'none';
            if (navPostsInput) navPostsInput.style.display = 'none';
            if (navPostsLabel) navPostsLabel.style.display = 'none';
            if (navPostsInput && navPostsInput.checked) {
                var navProjects = document.getElementById('nav-projects');
                if (navProjects) navProjects.checked = true;
            }
            return;
        }

        if (postsCard) postsCard.style.display = '';
        if (navPostsInput) navPostsInput.style.display = '';
        if (navPostsLabel) navPostsLabel.style.display = '';

        if (document.hidden) {
            setTimeout(loadPosts, 1000);
            return;
        }

        var controller = (window.AbortController ? new AbortController() : null);
        _postsAbort = controller;

        var t = setTimeout(function() {
            if (controller) controller.abort();
        }, 60000);

        var headers = {};
        if (_postsEtag) headers['If-None-Match'] = _postsEtag;

        fetch('admin/api.php?action=get_posts', {
            method: 'GET',
            headers: headers,
            cache: 'no-cache',
            signal: controller ? controller.signal : undefined
        })
        .then(function(r) {
            clearTimeout(t);
            if (!r.ok) throw new Error('bad status ' + r.status);
            var et = r.headers.get('ETag');
            if (et) _postsEtag = et;
            return r.json();
        })
        .then(function(res) {
            if (!res || !res.success) {
                showPostsEmpty(container, '加载失败');
                return;
            }
            var data = Array.isArray(res.data) ? res.data : [];
            renderPosts(container, data);
        })
        .catch(function(err) {
            clearTimeout(t);
            console.error('加载帖子失败:', err);
            showPostsEmpty(container, '加载失败');
        });
    }

    var _postsDataMap = {};
    var _postImgObserver = null;
    var POSTS_BATCH_SIZE = 6;
    var _postCoverPlaceholderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

    function getPostImgObserver() {
        if (_postImgObserver) return _postImgObserver;
        _postImgObserver = new IntersectionObserver(function(entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    var img = entries[i].target;
                    var src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                    }
                    _postImgObserver.unobserve(img);
                }
            }
        }, { rootMargin: '0px 200px 0px 200px' });
        return _postImgObserver;
    }

    function createPostItem(post, index) {
        var item = document.createElement('div');
        item.className = 'post-item';
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('data-post-idx', index);

        if (post.cover) {
            var img = document.createElement('img');
            img.className = 'post-cover';
            img.alt = post.title || '封面';
            img.decoding = 'async';
            if (index < POSTS_BATCH_SIZE) {
                img.src = post.cover;
            } else {
                img.setAttribute('data-src', post.cover);
                getPostImgObserver().observe(img);
            }
            item.appendChild(img);
        } else {
            var placeholder = document.createElement('div');
            placeholder.className = 'post-cover-placeholder';
            placeholder.innerHTML = _postCoverPlaceholderSvg;
            item.appendChild(placeholder);
        }

        var content = document.createElement('div');
        content.className = 'post-content';
        var h4 = document.createElement('h4');
        h4.className = 'post-title';
        h4.textContent = post.title || '无标题';
        content.appendChild(h4);
        if (post.subtitle) {
            var p = document.createElement('p');
            p.className = 'post-subtitle';
            p.textContent = post.subtitle;
            content.appendChild(p);
        }
        item.appendChild(content);

        return item;
    }

    function renderPostsBatch(container, data, startIdx) {
        var end = Math.min(startIdx + POSTS_BATCH_SIZE, data.length);
        var frag = document.createDocumentFragment();
        for (var i = startIdx; i < end; i++) {
            frag.appendChild(createPostItem(data[i], i));
        }
        container.appendChild(frag);

        if (end < data.length) {
            requestAnimationFrame(function() {
                renderPostsBatch(container, data, end);
            });
        }
    }

    function setupPostsDelegation(container) {
        container.addEventListener('click', function(e) {
            var item = e.target.closest('.post-item');
            if (!item) return;
            var idx = item.getAttribute('data-post-idx');
            if (idx != null && _postsDataMap[idx]) openPostLightbox(_postsDataMap[idx]);
        });
        container.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var item = e.target.closest('.post-item');
            if (!item) return;
            e.preventDefault();
            var idx = item.getAttribute('data-post-idx');
            if (idx != null && _postsDataMap[idx]) openPostLightbox(_postsDataMap[idx]);
        });
    }

    var _postsDelegated = false;

    function renderPosts(container, data) {
        container.textContent = '';

        if (!data.length) {
            showPostsEmpty(container, '暂无帖子内容');
            return;
        }

        var newSig = data.map(function(p) {
            var len = (p && p.content) ? String(p.content).length : 0;
            return (p.id || '') + '|' + (p.title || '') + '|' + (p.subtitle || '') + '|' + (p.cover || '') + '|' + len + '|' + (p.created_at || '');
        }).join('||');

        if (newSig === _postsSig) return;
        _postsSig = newSig;

        _postsDataMap = {};
        for (var i = 0; i < data.length; i++) {
            _postsDataMap[i] = data[i];
        }

        if (_postImgObserver) {
            _postImgObserver.disconnect();
        }

        var wrap = container.parentElement;
        if (!wrap.classList.contains('posts-scroll-wrap')) {
            var outer = document.createElement('div');
            outer.className = 'posts-scroll-wrap';
            wrap.insertBefore(outer, container);
            outer.appendChild(container);
            wrap = outer;
        }

        if (!_postsDelegated) {
            setupPostsDelegation(container);
            _postsDelegated = true;
        }

        renderPostsBatch(container, data, 0);

        wrap.querySelectorAll('.posts-nav').forEach(function(n) { n.remove(); });

        if (data.length > 3) {
            var arrowSvgL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>';
            var arrowSvgR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>';

            var btnL = document.createElement('button');
            btnL.className = 'posts-nav posts-nav-left';
            btnL.innerHTML = arrowSvgL;
            btnL.title = '上一页';
            btnL.type = 'button';

            var btnR = document.createElement('button');
            btnR.className = 'posts-nav posts-nav-right visible';
            btnR.innerHTML = arrowSvgR;
            btnR.title = '下一页';
            btnR.type = 'button';

            wrap.appendChild(btnL);
            wrap.appendChild(btnR);

            function updateNavState() {
                var sl = container.scrollLeft, sw = container.scrollWidth, cw = container.clientWidth;
                btnL.classList.toggle('visible', sl > 10);
                btnR.classList.toggle('visible', sl < sw - cw - 10);
            }

            function scrollBy(dir) {
                var itemW = container.querySelector('.post-item');
                var step = itemW ? (itemW.offsetWidth + 20) : container.clientWidth * 0.8;
                container.scrollBy({ left: dir * step, behavior: 'smooth' });
            }

            btnL.addEventListener('click', function(e) { e.stopPropagation(); scrollBy(-1); });
            btnR.addEventListener('click', function(e) { e.stopPropagation(); scrollBy(1); });
            container.addEventListener('scroll', updateNavState, { passive: true });
            updateNavState();
        }
    }

    function showPostsEmpty(container, text) {
        container.textContent = '';
        var wrap = document.createElement('div');
        wrap.className = 'posts-empty';
        wrap.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
            '<polyline points="14 2 14 8 20 8"/>' +
            '<line x1="16" y1="13" x2="8" y2="13"/>' +
            '<line x1="16" y1="17" x2="8" y2="17"/>' +
            '</svg>' +
            '<span>' + esc(text) + '</span>';
        container.appendChild(wrap);
    }

    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && _postsSig === '') {
            loadPosts();
        }
    });

    // ========== 回复模块 ==========
    var _repliesSig = '';
    var _repliesEtag = '';
    var _repliesTimer = null;
    var _repliesAbort = null;
    var _repliesLoadedOnce = false;
    var _lightbox = null;
    var _lightboxImg = null;

    function initLightbox() {
        if (_lightbox) return;
        var lb = document.createElement('div');
        lb.className = 'lightbox';
        lb.setAttribute('role', 'dialog');
        lb.setAttribute('aria-modal', 'true');
        lb.innerHTML =
            '<div class="lightbox-dialog">' +
            '<button type="button" class="lightbox-close" aria-label="关闭">×</button>' +
            '<img class="lightbox-img" alt="预览">' +
            '</div>';
        document.body.appendChild(lb);
        _lightbox = lb;
        _lightboxImg = lb.querySelector('.lightbox-img');

        lb.addEventListener('click', function (e) {
            if (e.target === lb) closeLightbox();
        });
        lb.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeLightbox();
        });
    }

    function openLightbox(src) {
        initLightbox();
        if (!_lightbox || !_lightboxImg) return;

        _lightboxImg.alt = '加载中...';
        _lightbox.classList.add('open');
        document.documentElement.style.overflow = 'hidden';

        _lightboxImg.onload = function() {
            _lightboxImg.alt = '预览';
        };
        _lightboxImg.onerror = function() {
            _lightboxImg.alt = '图片加载失败';
        };

        _lightboxImg.src = src;
    }

    function closeLightbox() {
        if (!_lightbox) return;
        _lightbox.classList.remove('open');
        if (_lightboxImg) _lightboxImg.src = '';
        document.documentElement.style.overflow = '';
    }

    function safeText(v, maxLen) {
        if (v == null) return '';
        var s = String(v);
        if (s.length > (maxLen || 400)) s = s.slice(0, (maxLen || 400));
        return s.trim();
    }

    function normalizeReplyImage(p) {
        if (!p) return '';
        var s = String(p).trim();
        if (s.indexOf('admin/img.php?t=') === 0) return s;
        return '';
    }

    function showRepliesLoading(container) {
        container.textContent = '';
        var wrap = document.createElement('div');
        wrap.className = 'replies-loading';
        wrap.innerHTML =
            '<svg class="replies-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>' +
            '<path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>' +
            '</svg>' +
            '<span>加载中...</span>';
        container.appendChild(wrap);
    }

    function showRepliesEmpty(container, text) {
        container.textContent = '';
        var wrap = document.createElement('div');
        wrap.className = 'replies-empty';
        wrap.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
            '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
            '</svg>';
        var p = document.createElement('p');
        p.textContent = text || '暂无回复内容';
        wrap.appendChild(p);
        container.appendChild(wrap);
    }

    function computeRepliesSig(data) {
        if (!Array.isArray(data)) return '';
        return data.map(function (it) {
            return [
                safeText(it && it.name, 60),
                safeText(it && it.email_masked, 80),
                safeText(it && it.reply_time, 60),
                safeText(it && it.message_preview, 500),
                safeText(it && it.reply_preview, 500),
                normalizeReplyImage(it && it.image)
            ].join('\u0000');
        }).join('\u0001');
    }

    function renderReplies(container, data) {
        container.textContent = '';
        var frag = document.createDocumentFragment();

        data.forEach(function (item, index) {
            var name = safeText(item && item.name, 60) || '匿名';
            var timeRaw = safeText(item && item.reply_time, 60);
            var emailMasked = safeText(item && item.email_masked, 80);
            var userContent = safeText(item && item.message_preview, 800);
            var replyContent = safeText(item && item.reply_preview, 800);
            var imgPath = normalizeReplyImage(item && (item.image_url || item.imageUrl || item.image));
            var isFirst = (index === 0);

            if (!userContent && !replyContent) return;

            var card = document.createElement('div');
            card.className = 'reply-item';

            var header = document.createElement('div');
            header.className = 'reply-header';

            var avatar = document.createElement('div');
            avatar.className = 'reply-avatar';
            avatar.innerHTML =
                '<svg class="reply-avatar-svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>' +
                '<circle cx="12" cy="7" r="4"></circle>' +
                '</svg>';

            var meta = document.createElement('div');
            meta.className = 'reply-meta';
            var nm = document.createElement('div');
            nm.className = 'reply-name';
            nm.textContent = name;
            var tm = document.createElement('div');
            tm.className = 'reply-time';
            tm.textContent = formatReplyTime(timeRaw) + (emailMasked ? ' · ' + emailMasked : '');
            meta.appendChild(nm);
            meta.appendChild(tm);

            var badge = document.createElement('span');
            badge.className = 'reply-badge';
            badge.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                '<polyline points="20 6 9 17 4 12"/>' +
                '</svg>已回复';

            header.appendChild(avatar);
            header.appendChild(meta);
            header.appendChild(badge);
            card.appendChild(header);

            if (imgPath) {
                var imgWrap = document.createElement('div');
                imgWrap.className = 'reply-image';

                var link = document.createElement('a');
                link.href = imgPath;
                link.rel = 'noopener noreferrer';
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    openLightbox(imgPath);
                });

                var img = document.createElement('img');
                img.src = imgPath;
                img.alt = '用户图片';
                img.loading = 'lazy';
                img.decoding = 'async';
                img.referrerPolicy = 'no-referrer';
                img.addEventListener('error', function () {
                    if (imgWrap && imgWrap.parentNode) imgWrap.parentNode.removeChild(imgWrap);
                });

                link.appendChild(img);
                imgWrap.appendChild(link);
                card.appendChild(imgWrap);
            }

            var content = document.createElement('div');
            content.className = 'reply-content';
            if (userContent) {
                var u = document.createElement('div');
                u.className = 'reply-user';
                u.textContent = '用户：' + userContent;
                content.appendChild(u);
            }
            if (replyContent) {
                var a = document.createElement('div');
                a.className = 'reply-admin';
                a.textContent = '管理员：' + replyContent;
                content.appendChild(a);
            }
            card.appendChild(content);

            if (isFirst) {
                frag.appendChild(card);
            } else {
                var wrap = document.createElement('div');
                wrap.className = 'reply-collapsible';

                var summary = [];
                if (name) summary.push(name);
                var timeLabel = formatReplyTime(timeRaw);
                if (timeLabel) summary.push(timeLabel);
                if (emailMasked) summary.push(emailMasked);

                var toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'reply-toggle';

                var baseLabel = summary.join(' · ') || '历史回复';
                var expanded = false;
                function updateToggleLabel() {
                    toggle.textContent = baseLabel + (expanded ? '（点击收起）' : '（点击展开）');
                }
                updateToggleLabel();

                card.classList.add('reply-card-collapsed');

                wrap.appendChild(toggle);
                wrap.appendChild(card);

                toggle.addEventListener('click', function () {
                    expanded = !expanded;
                    if (expanded) {
                        card.classList.remove('reply-card-collapsed');
                    } else {
                        card.classList.add('reply-card-collapsed');
                    }
                    updateToggleLabel();
                });

                frag.appendChild(wrap);
            }
        });

        container.appendChild(frag);
    }

    function scheduleReplies(delayMs) {
        if (_repliesTimer) clearTimeout(_repliesTimer);
        _repliesTimer = setTimeout(loadReplies, delayMs);
    }

    function loadReplies() {
        var container = document.getElementById('repliesList');
        if (!container) return;

        if (document.hidden) {
            scheduleReplies(30000);
            return;
        }

        if (!_repliesLoadedOnce) showRepliesLoading(container);

        if (_repliesAbort) {
            try { _repliesAbort.abort(); } catch (e) {}
        }
        var controller = (window.AbortController ? new AbortController() : null);
        _repliesAbort = controller;

        var t = setTimeout(function () {
            if (controller) controller.abort();
        }, 60000);

        var headers = {};
        if (_repliesEtag) headers['If-None-Match'] = _repliesEtag;

        fetch('admin/api.php?action=get_replies', {
            method: 'GET',
            headers: headers,
            cache: 'no-cache',
            signal: controller ? controller.signal : undefined
        })
        .then(function (r) {
            clearTimeout(t);
            if (r.status === 304) {
                _repliesLoadedOnce = true;
                scheduleReplies(30000);
                return null;
            }
            if (!r.ok) throw new Error('bad status ' + r.status);
            var et = r.headers.get('ETag');
            if (et) _repliesEtag = et;
            return r.json();
        })
        .then(function (res) {
            if (!res) return;
            _repliesLoadedOnce = true;
            var data = (res && res.success && Array.isArray(res.data)) ? res.data : [];
            if (!data.length) {
                _repliesSig = 'EMPTY';
                showRepliesEmpty(container, '暂无回复内容');
                scheduleReplies(30000);
                return;
            }

            var newSig = computeRepliesSig(data);
            if (newSig !== _repliesSig) {
                _repliesSig = newSig;
                renderReplies(container, data);
            }
            scheduleReplies(30000);
        })
        .catch(function (err) {
            clearTimeout(t);
            console.error('加载回复失败:', err);
            scheduleReplies(45000);
            if (!_repliesLoadedOnce) showRepliesEmpty(container, '加载失败，请稍后重试');
        });
    }

    function formatReplyTime(timeStr) {
        if (!timeStr) return '';
        var date = new Date(timeStr.replace(' ', 'T'));
        if (isNaN(date.getTime())) return '';
        var now = new Date();
        var diff = now - date;
        if (diff < 0) diff = 0;
        var days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return '今天';
        if (days === 1) return '昨天';
        if (days < 7) return days + '天前';
        if (days < 30) return Math.floor(days / 7) + '周前';
        if (days < 365) return Math.floor(days / 30) + '月前';
        return Math.floor(days / 365) + '年前';
    }

    loadReplies();
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            if (_repliesTimer) { clearTimeout(_repliesTimer); _repliesTimer = null; }
            if (_repliesAbort) { try { _repliesAbort.abort(); } catch(e){} _repliesAbort = null; }
        } else {
            scheduleReplies(200);
        }
    });
})();

// ==================== 滚动渐入动画 ====================
(function() {
    var items = document.querySelectorAll('.fade-in');
    if (!items.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        items.forEach(function(el) { el.classList.add('visible'); });
        return;
    }
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08 });
    items.forEach(function(el, i) {
        el.style.transitionDelay = (i * 0.07) + 's';
        observer.observe(el);
    });
})();
