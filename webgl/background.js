/* ============================================================
   yaoxi.wiki — WebGL2 全屏物理光追 / 全天候环境光引擎 控制器
   ─────────────────────────────────────────────────────────
   · 单 Draw Call 全屏大三角形（3 顶点，零索引缓冲）
   · 双模天气状态机：CLEAR / RAIN 平滑过渡（uWeather 插值）
   · 北京时间（UTC+8）太阳仰角/天顶角解算 + 24h 循环
     Catmull-Rom 色温三次样条（毫秒级连续）
   · 入口严格嗅探 WebGL2；不满足直接拦截并提示更换现代设备
   · 100% 满血点对点渲染：canvas 尺寸 = 视口 * 原生 DPR，不做任何降采样
   ============================================================ */
(function () {
    "use strict";

    /* ---------------- 运行时可覆盖配置 ---------------- */
    const CFG = (window.__yaoxiRTG && window.__yaoxiRTG.config) || {};
    const SHADER_PATH = CFG.shaderPath || null;   // 默认 null → 使用下方内嵌着色器源码
    const CARD_SELECTOR = CFG.cardSelector || ".news-card, .slide-text";
    const MAX_CARDS = 8;
    const MARCH_DEFAULT = CFG.marchSteps || 64;

    /* ---------------- 内嵌 GLSL（与 webgl/background.vert / .frag 保持一致） ----------------
       默认直内嵌 → 零额外请求、PWA 离线可用、无 fetch 时序失败面；
       如需单独调试着色器，可配置 window.__yaoxiRTG.config.shaderPath = { vert, frag }
       指向源文件后由引擎 fetch 覆盖（开发期用，生产默认内嵌）。       */
    const EMBED_VERT = `
#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
    vec2 p = aPos;
    vUv = p * 0.5 + 0.5;
    gl_Position = vec4(p, 0.0, 1.0);
}
`;

    const EMBED_FRAG = `
#version 300 es
precision mediump float;
uniform vec2  uResolution;
uniform vec2  uSunPos;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform vec3  uSkyZenith;
uniform vec3  uSkyHorizon;
uniform vec3  uAmbient;
uniform vec3  uGround;
uniform float uSunElev;
uniform float uTime;
uniform float uScrollY;
uniform float uDPR;
uniform float uWeather;
uniform float uRain;
uniform float uTheme;
uniform float uMarch;
uniform int   uCardCount;
uniform vec4  uCards[8];
uniform vec2  uCursor;
uniform float uCursorL;
in vec2 vUv;
out vec4 fragColor;
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
        s += a * vnoise(p);
        p = p * 2.03 + 17.1;
        a *= 0.5;
    }
    return s;
}
float fbm2(vec2 p) {
    float s = 0.0;
    float a = 0.6;
    for (int i = 0; i < 2; i++) {
        s += a * vnoise(p);
        p = p * 2.13 + 11.7;
        a *= 0.5;
    }
    return s;
}
vec3 skyBase(vec2 px) {
    vec2 uv = px / uResolution;
    float he = clamp(uv.y, 0.0, 1.0);
    vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(he, 0.45));
    float sunUp = smoothstep(-0.15, 0.22, uSunElev);
    vec2 toSun = uSunPos - px;
    float sd = length(toSun);
    float disc = exp(-sd * sd * 0.9);
    float glow = exp(-sd * sd * 0.0006);
    float haze = exp(-sd * sd * 0.00018);
    sky += uSunColor * (disc * 1.5 + glow * 0.12 + haze * 0.30) * sunUp;
    float g = smoothstep(0.55, 0.62, uv.y);
    sky = mix(sky, uGround, g * 0.88);
    float stars = pow(max(vnoise(px * 0.02 * uDPR) - 0.966, 0.0) * 30.0, 2.0);
    stars *= (1.0 - sunUp) * smoothstep(0.30, 0.55, uv.y);
    sky += vec3(0.8, 0.85, 1.0) * stars * 0.5;
    return sky;
}
vec3 atmo(vec2 px) {
    vec3 c = skyBase(px);
    float sunUp = smoothstep(-0.05, 0.25, uSunElev);
    float clearK = (1.0 - uWeather);
    vec2 dir = (uSunPos - px) / max(uMarch, 1.0);
    float t = 0.0;
    vec3 beam = vec3(0.0);
    float scale = uResolution.y * 0.0016;
    for (int i = 0; i < 64; i++) {
        vec2 sp = px + dir * t;
        float dens = fbm2(sp * scale + vec2(0.0, uTime * 0.02));
        float occ = smoothstep(0.42, 0.64, dens);
        beam += uSunColor * (1.0 - occ) * (1.0 - t * 0.012) * 0.05;
        t += 1.0;
    }
    c += beam * sunUp * clearK * 0.55;
    vec2 q = px * 0.0022 * uDPR + vec2(uTime * 0.030, uTime * 0.015);
    float n = fbm(q);
    float spark = pow(max(n - 0.52, 0.0) * 6.0, 2.2);
    float dSun = length(uSunPos - px);
    float sunNear = exp(-dSun * 0.0045);
    c += uSunColor * spark * sunNear * 0.45 * clearK * sunUp;
    c += uAmbient * spark * 0.10 * clearK;
    return c;
}
float rainStreaks(vec2 p, float t) {
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
        vec2 g = vec2(float(i) * 7.13, float(i) * 13.7);
        vec2 cell = floor(p * 16.0 + g);
        float h = hash21(cell);
        vec2 o = vec2(h, fract(h * 7.31));
        vec2 q = fract(p * 16.0 + g) - o;
        vec2 d = normalize(vec2(0.35, -1.0));
        float along = dot(q, d) + t * (7.0 + float(i) * 2.0) + o.x * 5.0;
        float across = abs(dot(q, vec2(d.y, -d.x)));
        float lenM = smoothstep(0.0, 0.02, along) * smoothstep(0.22, 0.02, along);
        float widM = 1.0 - smoothstep(0.0, 0.018, across);
        s += lenM * widM * step(0.45, h);
    }
    return s * 0.5;
}
vec2 ripples(vec2 p, float t) {
    vec2 acc = vec2(0.0);
    for (int i = 0; i < 6; i++) {
        vec2 g = vec2(float(i) * 21.31, float(i) * 37.71);
        vec2 cell = floor(p * 5.0 + g);
        float ha = hash21(cell);
        float hb = hash21(cell + 7.31);
        vec2 cc = cell + vec2(ha, hb);
        vec2 d = p * 5.0 + g - cc;
        float dist = length(d);
        float speed = 3.2 + float(i) * 0.9;
        float phase = dist * 24.0 - t * speed;
        float amp = exp(-dist * 4.2) * (0.5 + 0.5 * sin(phase * 0.4));
        float w = smoothstep(1.0, 0.25, dist);
        acc += vec2(cos(phase), sin(phase)) * amp * w * (0.4 + 0.6 * ha);
    }
    return acc * 0.14;
}
float rectMask(vec2 p, vec4 r) {
    vec2 d0 = p - r.xy;
    vec2 d1 = r.xy + r.zw - p;
    float mx = min(min(d0.x, d0.y), min(d1.x, d1.y));
    return smoothstep(0.0, 2.0, mx);
}
float edgeDist(vec2 p, vec4 r) {
    vec2 h = r.zw * 0.5;
    vec2 c = r.xy + h;
    vec2 q = abs(p - c) - h;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    return -d;
}
float ggxD(float NoH, float a2) {
    float d = NoH * NoH * (a2 - 1.0) + 1.0;
    return a2 / max(3.14159265 * d * d, 1e-5);
}
float schlickF(float NoV, float f0) {
    return f0 + (1.0 - f0) * pow(1.0 - NoV, 5.0);
}
vec3 cardSplashes(vec2 px, vec4 r, float t, float rain) {
    vec3 s = vec3(0.0);
    for (int i = 0; i < 6; i++) {
        float hx = hash21(vec2(float(i) * 3.7, 1.3));
        float hy = hash21(vec2(float(i) * 9.1, 5.7));
        vec2 sp = vec2(r.x + hx * r.z, r.y + r.w - hy * 6.0);
        float d = length(px - sp);
        float pulse = 0.5 + 0.5 * sin(t * 26.0 + float(i) * 2.6);
        float cycle = fract(hx * 7.0 + t * 0.5);
        float life = smoothstep(0.0, 1.0, cycle) * (1.0 - smoothstep(0.0, 1.0, cycle));
        float m = exp(-d * d * 0.06) * pulse * life;
        s += vec3(0.75, 0.9, 1.0) * m;
    }
    return s * rain * 1.1;
}
void main() {
    vec2 px = gl_FragCoord.xy;
    vec2 basePx = px + vec2(0.0, uScrollY * 0.16);
    vec2 dp = basePx / uResolution.y;
    vec2 rip = ripples(dp, uTime);
    vec2 refr = rip * (14.0 * uRain);
    vec3 atmoRefr = atmo(px + refr);
    vec3 bg = atmo(basePx);
    float streak = rainStreaks(dp, uTime);
    vec3 rainBg = atmoRefr * (0.86 + 0.20 * streak) + uAmbient * 0.10;
    bg = mix(bg, rainBg, uWeather);
    float sunUp = smoothstep(-0.05, 0.25, uSunElev);
    vec3 tint = mix(vec3(0.55, 0.65, 0.82), vec3(0.93, 0.96, 1.0), uTheme);
    float glassA = mix(0.88, 0.72, uTheme);
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 N = normalize(vec3(rip * 0.5, 1.0));
    float NoV = max(dot(N, V), 0.0);
    float roug = 0.34;
    float a2 = roug * roug * roug * roug;
    vec3 glassAcc = vec3(0.0);
    float cov = 0.0;
    for (int i = 0; i < 8; i++) {
        float act = step(float(i) + 0.5, float(uCardCount) - 0.5);
        vec4 r = uCards[i];
        float m = rectMask(px, r) * act;
        float edge = edgeDist(px, r);
        float inEdge = (1.0 - exp(-edge * 0.06)) * step(0.0, edge);
        vec3 col = atmoRefr * tint;
        vec3 chroma = vec3(0.0);
        chroma.r = skyBase(px + refr + vec2(3.0, 0.0)).r;
        chroma.g = skyBase(px + refr + vec2(0.0, 0.0)).g;
        chroma.b = skyBase(px + refr + vec2(-3.0, 0.0)).b;
        float dispK = mix(0.5, 1.8, uRain) * (0.3 + 0.7 * sunUp);
        col += (chroma - atmoRefr) * (inEdge * dispK);
        vec3 Ls = uSunDir;
        vec3 Hs = normalize(V + Ls);
        float NoH = max(dot(N, Hs), 0.0);
        float NoL = max(dot(N, Ls), 0.0);
        float Ds = ggxD(NoH, a2);
        float Fs = schlickF(NoV, 0.04);
        vec3 sunSpec = uSunColor * Ds * Fs * NoL * sunUp * 0.28;
        vec3 Lc = normalize(vec3(uCursor - px, -uResolution.y * 0.55));
        vec3 Hc = normalize(V + Lc);
        float NoHc = max(dot(N, Hc), 0.0);
        float NoLc = max(dot(N, Lc), 0.0);
        float Dc = ggxD(NoHc, a2);
        float Fc = schlickF(NoV, 0.04);
        vec3 curSpec = vec3(1.0, 0.98, 0.94) * Dc * Fc * NoLc * uCursorL * 0.6;
        float inter = 0.5 + 0.5 * sin(NoH * 40.0 + (1.0 - roug) * 14.0);
        vec3 irid = mix(vec3(0.25, 0.6, 1.0), vec3(1.0, 0.35, 0.55), inter);
        col += (sunSpec + curSpec) * (0.55 + 0.45 * irid);
        col += uSunColor * Fs * inEdge * sunUp * 0.9;
        col += cardSplashes(px, r, uTime, uRain);
        glassAcc += col * m;
        cov += m;
    }
    cov = clamp(cov, 0.0, 1.0);
    vec3 final = mix(bg, glassAcc, cov * glassA);
    vec2 qv = px / uResolution - 0.5;
    final *= 1.0 - dot(qv, qv) * 0.35;
    final += (hash21(px) - 0.5) * (1.5 / 255.0);
    fragColor = vec4(final, 1.0);
}
`;

    /* ---------------- 北京时间太阳解算（北京 116.4074E / 39.9042N） ---------------- */
    const OBS_LAT = 39.9042 * Math.PI / 180;
    const OBS_LON = 116.4074;
    const TZ = 8;

    function solarPosition(now) {
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const bj = new Date(utc + TZ * 3600 * 1000);
        const y = bj.getUTCFullYear();
        const startOfYear = Date.UTC(y, 0, 0);
        const doy = Math.floor(
            (Date.UTC(y, bj.getUTCMonth(), bj.getUTCDate()) - startOfYear) / 86400000
        );
        const hours = bj.getUTCHours() + bj.getUTCMinutes() / 60 + bj.getUTCSeconds() / 3600;
        const f = (2 * Math.PI / 365.0) * (doy - 1 + hours / 24);
        const eq = 229.18 * (
            0.000075 + 0.001868 * Math.cos(f) - 0.032077 * Math.sin(f)
            - 0.014615 * Math.cos(2 * f) - 0.040849 * Math.sin(2 * f)
        );
        const decl = 0.006918 - 0.399912 * Math.cos(f) + 0.070257 * Math.sin(f)
            - 0.006758 * Math.cos(2 * f) + 0.000907 * Math.sin(2 * f)
            - 0.002697 * Math.cos(3 * f) + 0.00148 * Math.sin(3 * f);
        const lst = hours * 15 + (OBS_LON - TZ * 15) + eq / 4;
        const ha = (lst - 180) * Math.PI / 180;
        const sinEl = Math.sin(OBS_LAT) * Math.sin(decl)
            + Math.cos(OBS_LAT) * Math.cos(decl) * Math.cos(ha);
        const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl)));
        const cosAz = (Math.sin(decl) - Math.sin(elevation) * Math.sin(OBS_LAT))
            / (Math.cos(elevation) * Math.cos(OBS_LAT) || 1e-9);
        let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz)));
        if (Math.sin(ha) > 0) azimuth = 2 * Math.PI - azimuth;
        return { elevation, azimuth, hours };
    }

    /* ---------------- 大气色温三次样条（Catmull-Rom，按北京小时 24h 循环） ----------------
       关键帧编码：深夜幽蓝 → 晨曦冷暖交织 → 日出 ~3000K →
       正午冷白 ~6500K → 夕阳金红瑞利散射 → 暮色 → 回到深夜       */
    const COLOR_KNOTS = [
        { h: 0,  zen: [0.006, 0.013, 0.038], hor: [0.018, 0.032, 0.080], sun: [0.50, 0.55, 0.95], amb: [0.045, 0.060, 0.130], gnd: [0.015, 0.026, 0.055] },
        { h: 4,  zen: [0.006, 0.013, 0.038], hor: [0.018, 0.032, 0.080], sun: [0.50, 0.55, 0.95], amb: [0.045, 0.060, 0.130], gnd: [0.015, 0.026, 0.055] },
        { h: 5,  zen: [0.020, 0.040, 0.100], hor: [0.100, 0.090, 0.240], sun: [0.80, 0.70, 1.20], amb: [0.090, 0.090, 0.180], gnd: [0.040, 0.050, 0.100] },
        { h: 6,  zen: [0.100, 0.170, 0.360], hor: [0.900, 0.600, 0.450], sun: [1.50, 0.80, 0.45], amb: [0.200, 0.170, 0.240], gnd: [0.090, 0.090, 0.150] },
        { h: 7,  zen: [0.160, 0.250, 0.470], hor: [0.700, 0.620, 0.550], sun: [1.25, 1.00, 0.85], amb: [0.280, 0.290, 0.380], gnd: [0.110, 0.120, 0.180] },
        { h: 12, zen: [0.120, 0.220, 0.450], hor: [0.550, 0.670, 0.860], sun: [1.05, 1.00, 0.95], amb: [0.380, 0.440, 0.560], gnd: [0.140, 0.160, 0.240] },
        { h: 16, zen: [0.150, 0.250, 0.460], hor: [0.600, 0.680, 0.850], sun: [1.02, 0.99, 0.95], amb: [0.340, 0.400, 0.520], gnd: [0.130, 0.150, 0.220] },
        { h: 18, zen: [0.200, 0.280, 0.440], hor: [1.000, 0.500, 0.300], sun: [1.60, 0.55, 0.25], amb: [0.250, 0.160, 0.180], gnd: [0.100, 0.080, 0.120] },
        { h: 19, zen: [0.060, 0.100, 0.220], hor: [0.500, 0.250, 0.350], sun: [1.20, 0.50, 0.60], amb: [0.120, 0.090, 0.160], gnd: [0.050, 0.040, 0.080] },
        { h: 21, zen: [0.012, 0.025, 0.070], hor: [0.050, 0.070, 0.170], sun: [0.70, 0.70, 1.10], amb: [0.060, 0.070, 0.140], gnd: [0.020, 0.030, 0.070] },
        { h: 24, zen: [0.006, 0.013, 0.038], hor: [0.018, 0.032, 0.080], sun: [0.50, 0.55, 0.95], amb: [0.045, 0.060, 0.130], gnd: [0.015, 0.026, 0.055] }
    ];

    function catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * (
            (2 * p1)
            + (-p0 + p2) * t
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    }

    /* 返回 { zenith, horizon, sun, ambient, ground } 各为 [r,g,b] */
    function sampleSky(hours) {
        const n = COLOR_KNOTS.length;
        let i = n - 1;
        for (let k = 0; k < n; k++) {
            if (hours < COLOR_KNOTS[(k + 1) % n].h) { i = k; break; }
        }
        const a = COLOR_KNOTS[i % n];
        const b = COLOR_KNOTS[(i + 1) % n];
        const p0 = COLOR_KNOTS[(i - 1 + n) % n];
        const p3 = COLOR_KNOTS[(i + 2) % n];
        let span = b.h - a.h;
        if (span <= 0) span += 24;
        const t = (hours - a.h) / span;
        const interp = (key) => {
            const c0 = p0[key], c1 = a[key], c2 = b[key], c3 = p3[key];
            return [
                catmullRom(c0[0], c1[0], c2[0], c3[0], t),
                catmullRom(c0[1], c1[1], c2[1], c3[1], t),
                catmullRom(c0[2], c1[2], c2[2], c3[2], t)
            ];
        };
        return {
            zenith: interp("zen"),
            horizon: interp("hor"),
            sun: interp("sun"),
            ambient: interp("amb"),
            ground: interp("gnd")
        };
    }

    /* ---------------- 双模天气状态机 ---------------- */
    const WeatherFSM = {
        states: { CLEAR: 0, RAIN: 1 },
        state: 0,
        target: 0,
        smooth: 0,
        timer: 0,
        init() {
            this.smooth = 0;
            this.target = 0;
            this.state = this.states.CLEAR;
            this.timer = 40 + 20 * Math.random();
        },
        /* 返回 uWeather 0..1（约 2.5s 平滑过渡） */
        update(dt, solar) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = 60 + 60 * Math.random();
                const day = solar.elevation > -0.05;
                const wantRain = day && Math.random() < 0.32;
                this.target = wantRain ? this.states.RAIN : this.states.CLEAR;
            }
            const rate = 1 / 2.5;
            this.smooth += (this.target - this.smooth) * Math.min(1, rate * dt);
            this.smooth = Math.max(0, Math.min(1, this.smooth));
            this.state = this.smooth > 0.5 ? this.states.RAIN : this.states.CLEAR;
            return this.smooth;
        }
    };

    /* ---------------- 主控制器 ---------------- */
    class RTXBackground {
        constructor() {
            this.gl = null;
            this.prog = null;
            this.uniforms = {};
            this.canvas = null;
            this.dpr = 1;
            this.width = 0;
            this.height = 0;
            this.vao = null;
            this.motion = 1;
            this.running = false;
            this.raf = 0;
            this.last = 0;
            this.weatherSmooth = 0;
            this.cardData = new Float32Array(MAX_CARDS * 4);
            this.cardCount = 0;
            this.marchSteps = MARCH_DEFAULT;
            this.cursor = { x: -99999, y: -99999, tx: -99999, ty: -99999, l: 0, tl: 0 };
            this.scrollY = 0;
            this.state = "idle";
            this.software = false;
            this.wfsm = Object.create(WeatherFSM);
            this.theme = 0;
        }

        /* ---- 生命周期状态机 ---- */
        setState(s) {
            this.state = s;
        }

        /* ---- 入口：严格嗅探 WebGL2，采用三级降级策略 ----
           ① 硬件加速上下文（拒绝软件渲染）→ 优先，天玑 8350 等真机应命中此级
           ② 软件渲染上下文（部分手机 GPU 驱动被浏览器拉黑时回退 SwiftShader）
              → 仍可渲染，但自动降低体积光步数以保住帧率，不拦截
           ③ 完全无法创建 WebGL2 → 才拦截并提示更换现代浏览器/设备        */
        createContext() {
            const hw = {
                alpha: false,
                antialias: true,
                depth: false,
                stencil: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                powerPreference: "high-performance",
                desynchronized: true,
                failIfMajorPerformanceCaveat: true
            };
            const sw = Object.assign({}, hw, {
                powerPreference: "default",
                failIfMajorPerformanceCaveat: false,
                desynchronized: false
            });
            let gl = null;
            try { gl = this.canvas.getContext("webgl2", hw); } catch (e) { gl = null; }
            if (gl) { this.software = false; return gl; }
            try { gl = this.canvas.getContext("webgl2", sw); } catch (e) { gl = null; }
            if (gl) { this.software = true; return gl; }
            return null;
        }

        boot() {
            this.setState("probing");
            console.log("[RTX] boot @", navigator.userAgent.slice(0, 120));

            this.canvas = document.createElement("canvas");
            this.canvas.id = "rtx-canvas";
            this.canvas.setAttribute("aria-hidden", "true");
            this.canvas.style.cssText =
                "position:fixed;inset:0;z-index:-1;display:block;width:100%;height:100%;" +
                "pointer-events:none;background:transparent;";

            const gl = this.createContext();
            if (!gl) {
                this.fail("webgl2-unavailable",
                    "您的设备/浏览器无法创建 WebGL 2.0 上下文，无法运行物理光追引擎。请使用支持 WebGL 2.0 的现代浏览器（Chrome / Edge / Safari 15+）后重试。");
                return;
            }
            this.gl = gl;
            document.body.prepend(this.canvas);

            if (this.software) {
                /* 软件渲染：自动降低体积光步数，保底可渲染但不求 60fps */
                this.marchSteps = Math.min(this.marchSteps, CFG.softwareMarch || 20);
                console.warn("[RTX] 软件渲染 WebGL2（GPU 驱动可能被浏览器降级）。已自动降低体积光步数至 " + this.marchSteps + "，真机建议更换硬件加速浏览器获得满血光追。");
            }

            this.compile().then(() => {
                this.setupGeometry();
                this.setupUniforms();
                this.bindEvents();
                this.resize();
                this.syncCards();
                document.documentElement.classList.add("rtx-active");
                this.setState("ready");
                this.start();
            }).catch((err) => {
                console.warn("[RTX] 着色器编译失败，回退静态背景：", err);
                this.canvas.remove();
                this.fail("shader-fail", "图形引擎着色器编译失败，已回退到静态背景。");
            });
        }

        fail(reason, message) {
            this.setState("dead");
            this.failReason = reason;
            window.__rtxFail = { stage: reason, message, ua: navigator.userAgent };
            document.documentElement.classList.add("rtx-fallback");
            const bar = document.createElement("div");
            bar.id = "rtx-notice";
            bar.setAttribute("role", "status");
            bar.style.cssText =
                "position:fixed;left:16px;bottom:16px;z-index:9999;max-width:min(420px,calc(100vw-32px));" +
                "padding:12px 16px;border-radius:14px;font-size:13px;line-height:1.6;" +
                "color:#e8edff;background:rgba(16,26,48,0.92);border:1px solid rgba(255,255,255,0.16);" +
                "box-shadow:0 12px 34px rgba(0,0,0,0.35);backdrop-filter:blur(14px);";
            const text = document.createElement("span");
            text.textContent = message;
            const close = document.createElement("button");
            close.type = "button";
            close.setAttribute("aria-label", "关闭提示");
            close.textContent = "×";
            close.style.cssText =
                "margin-left:10px;border:0;background:transparent;color:#9fb0d8;font-size:18px;cursor:pointer;line-height:1;";
            close.addEventListener("click", () => bar.remove());
            bar.append(text, close);
            document.body.appendChild(bar);
        }

        async compile() {
            let vs, fs;
            if (SHADER_PATH) {
                [vs, fs] = await Promise.all([
                    fetch(SHADER_PATH.vert).then((r) => r.text()),
                    fetch(SHADER_PATH.frag).then((r) => r.text())
                ]);
            } else {
                vs = EMBED_VERT;
                fs = EMBED_FRAG;
            }
            const gl = this.gl;
            const compileShader = (type, src) => {
                const s = gl.createShader(type);
                gl.shaderSource(s, src);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                    const log = gl.getShaderInfoLog(s);
                    gl.deleteShader(s);
                    throw new Error("Shader compile: " + log);
                }
                return s;
            };
            const vsH = compileShader(gl.VERTEX_SHADER, vs);
            const fsH = compileShader(gl.FRAGMENT_SHADER, fs);
            const prog = gl.createProgram();
            gl.attachShader(prog, vsH);
            gl.attachShader(prog, fsH);
            gl.linkProgram(prog);
            gl.deleteShader(vsH);
            gl.deleteShader(fsH);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                throw new Error("Program link: " + gl.getProgramInfoLog(prog));
            }
            this.prog = prog;
        }

        setupGeometry() {
            const gl = this.gl;
            this.vao = gl.createVertexArray();
            gl.bindVertexArray(this.vao);
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            /* 全屏大三角形：覆盖 [-1,1]²，顶点不在角上 → 无对角线伪影 */
            gl.bufferData(gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.bindVertexArray(null);
        }

        setupUniforms() {
            const names = [
                "uResolution", "uSunPos", "uSunDir", "uSunColor",
                "uSkyZenith", "uSkyHorizon", "uAmbient", "uGround",
                "uSunElev", "uTime", "uScrollY", "uDPR",
                "uWeather", "uRain", "uTheme", "uMarch",
                "uCardCount", "uCards", "uCursor", "uCursorL"
            ];
            const loc = {};
            for (const n of names) loc[n] = this.gl.getUniformLocation(this.prog, n);
            this.uniforms = loc;
        }

        bindEvents() {
            window.addEventListener("resize", () => this.resize(), { passive: true });
            window.addEventListener("orientationchange", () => this.resize());

            let ticking = false;
            const onScroll = () => {
                if (!ticking) {
                    ticking = true;
                    requestAnimationFrame(() => {
                        ticking = false;
                        this.scrollY = (window.scrollY || 0) * this.dpr;
                        this.syncCards();
                    });
                }
            };
            window.addEventListener("scroll", onScroll, { passive: true });

            /* 光标辅助点光源（Pointer Events 兼容触控） */
            const onMove = (e) => {
                this.cursor.tx = e.clientX * this.dpr;
                this.cursor.ty = e.clientY * this.dpr;
                this.cursor.tl = 1;
            };
            window.addEventListener("pointermove", onMove, { passive: true });
            window.addEventListener("pointerdown", onMove, { passive: true });
            document.addEventListener("pointerleave", () => { this.cursor.tl = 0; });

            /* 图片加载完成后校正卡片几何（布局可能位移） */
            window.addEventListener("load", () => this.syncCards());
            if ("ResizeObserver" in window) {
                new ResizeObserver(() => this.syncCards())
                    .observe(document.getElementById("main-content") || document.body);
            }

            /* 后台暂停渲染，前台恢复（省电） */
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) this.pause();
                else this.resume();
            });

            this.motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.2 : 1;
        }

        resize() {
            const dpr = Math.max(1, window.devicePixelRatio || 1);
            this.dpr = dpr;
            const w = Math.max(1, Math.floor(window.innerWidth * dpr));
            const h = Math.max(1, Math.floor(window.innerHeight * dpr));
            this.width = w;
            this.height = h;
            if (this.canvas) {
                this.canvas.width = w;
                this.canvas.height = h;
            }
            this.syncCards();
        }

        /* 采集玻璃卡片几何 → uCards（视口像素 * DPR，与 canvas 设备像素对齐） */
        syncCards() {
            const els = document.querySelectorAll(CARD_SELECTOR);
            const data = this.cardData;
            let n = 0;
            for (let i = 0; i < els.length && i < MAX_CARDS; i++) {
                const r = els[i].getBoundingClientRect();
                const k = i * 4;
                data[k] = r.left * this.dpr;
                data[k + 1] = r.top * this.dpr;
                data[k + 2] = r.width * this.dpr;
                data[k + 3] = r.height * this.dpr;
                n++;
            }
            this.cardCount = n;
        }

        start() {
            if (this.running) return;
            this.running = true;
            this.last = performance.now();
            this.raf = requestAnimationFrame((t) => this.frame(t));
        }

        pause() {
            this.running = false;
            cancelAnimationFrame(this.raf);
        }

        resume() {
            if (this.state !== "ready" || this.running) return;
            this.last = performance.now();
            this.start();
        }

        frame(now) {
            if (!this.running) return;
            const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
            this.last = now;
            this.update(dt, now / 1000);
            this.draw();
            this.raf = requestAnimationFrame((t) => this.frame(t));
        }

        update(dt, time) {
            const gl = this.gl;
            const u = this.uniforms;
            const now = new Date();
            const solar = solarPosition(now);

            /* 北京时间色温三次样条（毫秒级连续） */
            const sky = sampleSky(solar.hours);
            const theme = document.documentElement.dataset.resolvedTheme === "light" ? 1 : 0;
            this.theme = theme;
            const lift = 1 + theme * 0.7;           /* 浅色主题整体提亮 */

            /* 太阳屏幕投影（相机面朝正南：rel=0 为正前方，日出东左、日没西右） */
            const rel = solar.azimuth - Math.PI;
            const el = solar.elevation;
            const dx = Math.sin(rel), dy = Math.sin(el), dz = Math.cos(rel);
            const L = Math.hypot(dx, dy, dz);
            const nd = { x: dx / L, y: dy / L, z: dz / L };
            const f = this.height * 1.1;
            const safeZ = Math.max(dz, 0.05);
            const sunX = this.width * 0.5 + (dx / safeZ) * f;
            const sunY = this.height * 0.5 - (dy / safeZ) * f;

            /* 天气状态机 */
            const weather = this.wfsm.update(dt, solar);
            const rain = Math.pow(weather, 1.5);

            /* 光标辅助光：指数平滑跟随 */
            const cu = this.cursor;
            cu.l += (cu.tl - cu.l) * Math.min(1, dt * 6);
            const cx = cu.x + (cu.tx - cu.x) * Math.min(1, dt * 24);
            const cy = cu.y + (cu.ty - cu.y) * Math.min(1, dt * 24);
            cu.x = cx; cu.y = cy;

            const set3 = (name, c, s) => gl.uniform3f(u[name], c[0] * s, c[1] * s, c[2] * s);

            set3("uSkyZenith", sky.zenith, lift);
            set3("uSkyHorizon", sky.horizon, lift);
            set3("uSunColor", sky.sun, 1);
            set3("uAmbient", sky.ambient, lift);
            set3("uGround", sky.ground, lift * 0.9);

            gl.uniform2f(u.uResolution, this.width, this.height);
            gl.uniform2f(u.uSunPos, sunX, sunY);
            gl.uniform3f(u.uSunDir, nd.x, nd.y, nd.z);
            gl.uniform1f(u.uSunElev, el);
            gl.uniform1f(u.uTime, time * this.motion);
            gl.uniform1f(u.uScrollY, this.scrollY);
            gl.uniform1f(u.uDPR, this.dpr);
            gl.uniform1f(u.uWeather, weather);
            gl.uniform1f(u.uRain, rain);
            gl.uniform1f(u.uTheme, theme);
            gl.uniform1f(u.uMarch, this.marchSteps);
            gl.uniform1i(u.uCardCount, this.cardCount);
            gl.uniform4fv(u.uCards, this.cardData);
            gl.uniform2f(u.uCursor, cx, cy);
            gl.uniform1f(u.uCursorL, cu.l);
        }

        draw() {
            const gl = this.gl;
            gl.viewport(0, 0, this.width, this.height);
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.BLEND);
            gl.useProgram(this.prog);
            gl.bindVertexArray(this.vao);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.bindVertexArray(null);
        }

        /* 调参入口 */
        setMarch(n) { this.marchSteps = Math.max(8, Math.min(128, n | 0)); }
        setWeather(weather) {
            this.wfsm.target = weather === "rain" ? this.wfsm.states.RAIN : this.wfsm.states.CLEAR;
        }
    }

    /* ---------------- 启动 ---------------- */
    function boot() {
        const rtx = new RTXBackground();
        window.__rtx = rtx;
        rtx.wfsm.init();
        rtx.boot();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
