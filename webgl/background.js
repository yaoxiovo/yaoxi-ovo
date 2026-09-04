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
precision highp float;
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
uniform float uBeamK;
uniform float uRefrK;
uniform int   uSteps;
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
vec3 godRays(vec2 px) {
    float sunUp = smoothstep(-0.05, 0.25, uSunElev);
    float clearK = (1.0 - uWeather);
    vec3 beam = vec3(0.0);
    vec2 dir = (uSunPos - px) / max(float(uSteps), 1.0);
    float t = 0.0;
    float scale = uResolution.y * 0.0016;
    for (int i = 0; i < uSteps; i++) {
        vec2 sp = px + dir * t;
        float dens = fbm2(sp * scale + vec2(0.0, uTime * 0.02));
        float occ = smoothstep(0.42, 0.64, dens);
        beam += uSunColor * (1.0 - occ) * (1.0 - t * 0.012) * 0.05;
        t += 1.0;
    }
    return beam * sunUp * clearK * 0.55 * uBeamK;
}
vec3 dust(vec2 px, float sunUp, float clearK) {
    vec3 c = vec3(0.0);
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
        float lenM = smoothstep(0.0, 0.02, along) * (1.0 - smoothstep(0.02, 0.22, along));
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
        float w = 1.0 - smoothstep(0.25, 1.0, dist);
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
    float sunUp = smoothstep(-0.05, 0.25, uSunElev);
    float clearK = (1.0 - uWeather);
    vec2 basePx = px + vec2(0.0, uScrollY * 0.16);
    vec2 dp = basePx / uResolution.y;
    vec2 rip = ripples(dp, uTime);
    vec2 refr = rip * (14.0 * uRain * uRefrK);
    vec3 beam = godRays(basePx);
    vec3 bg = skyBase(basePx) + beam + dust(basePx, sunUp, clearK);
    vec3 atmoRefr = skyBase(px + refr) + beam + dust(px + refr, sunUp, clearK);
    float streak = rainStreaks(dp, uTime);
    vec3 rainBg = atmoRefr * (0.86 + 0.20 * streak) + uAmbient * 0.10;
    bg = mix(bg, rainBg, uWeather);
    vec3 tint = mix(vec3(0.55, 0.65, 0.82), vec3(0.93, 0.96, 1.0), uTheme);
    float glassA = mix(0.88, 0.72, uTheme);
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 N = normalize(vec3(rip * 0.5, 1.0));
    float NoV = max(dot(N, V), 0.0);
    float roug = 0.34;
    float a2 = roug * roug * roug * roug;
    float dispK = mix(0.5, 1.8, uRain) * (0.3 + 0.7 * sunUp);
    vec3 Hs = normalize(V + uSunDir);
    float NoH = max(dot(N, Hs), 0.0);
    float NoL = max(dot(N, uSunDir), 0.0);
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
    vec3 spec = (sunSpec + curSpec) * (0.55 + 0.45 * irid);
    vec3 chroma = vec3(0.0);
    chroma.r = skyBase(px + refr + vec2(3.0, 0.0)).r;
    chroma.g = skyBase(px + refr + vec2(0.0, 0.0)).g;
    chroma.b = skyBase(px + refr + vec2(-3.0, 0.0)).b;
    vec3 dispersion = (chroma - atmoRefr) * dispK;
    vec3 glassAcc = vec3(0.0);
    float cov = 0.0;
    for (int i = 0; i < uCardCount; i++) {
        vec4 r = uCards[i];
        float m = rectMask(px, r);
        float edge = edgeDist(px, r);
        float inEdge = (1.0 - exp(-edge * 0.06)) * step(0.0, edge);
        vec3 col = atmoRefr * tint
                 + dispersion * inEdge
                 + spec
                 + uSunColor * Fs * inEdge * sunUp * 0.9
                 + cardSplashes(px, r, uTime, uRain);
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

    /* LITE 档位：无循环 / 无数组 / 无动态索引，纯数学大气 —— 驱动兼容性极高。
       保留：动态天空、太阳光盘与光晕、深夜星点、滚动视差、光标辉光、暗角、抖动。
       舍弃：体积光束、雨滴/涟漪、玻璃卡片光路（CSS 毛玻璃依旧生效）。 */
    const EMBED_FRAG_LITE = `
#version 300 es
precision highp float;
uniform vec2  uResolution;
uniform vec2  uSunPos;
uniform vec3  uSunColor;
uniform vec3  uSkyZenith;
uniform vec3  uSkyHorizon;
uniform vec3  uGround;
uniform float uSunElev;
uniform float uScrollY;
uniform float uDPR;
uniform float uWeather;
uniform float uBeamK;
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
void main() {
    vec2 px = gl_FragCoord.xy + vec2(0.0, uScrollY * 0.16);
    vec2 uv = px / uResolution;
    vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(clamp(uv.y, 0.0, 1.0), 0.45));
    float sunUp = smoothstep(-0.15, 0.22, uSunElev);
    float sd = length(uSunPos - px);
    sky += uSunColor * (exp(-sd * sd * 0.9) * 1.5 + exp(-sd * sd * 0.0006) * 0.12 + exp(-sd * sd * 0.00018) * 0.30) * sunUp * clamp(uBeamK, 0.0, 2.0) * (1.0 - clamp(uWeather, 0.0, 1.0) * 0.8);
    float g = smoothstep(0.55, 0.62, uv.y);
    sky = mix(sky, uGround, g * 0.88);
    float stars = pow(max(vnoise(px * 0.02 * uDPR) - 0.966, 0.0) * 30.0, 2.0);
    stars *= (1.0 - sunUp) * smoothstep(0.30, 0.55, uv.y) * (1.0 - clamp(uWeather, 0.0, 1.0));
    sky += vec3(0.8, 0.85, 1.0) * stars * 0.5;
    float cd = length(uCursor - gl_FragCoord.xy);
    sky += vec3(1.0, 0.98, 0.94) * exp(-cd * cd * 0.00002) * uCursorL * 0.30;
    /* 调节台反馈（LITE 简化档）：雨天压暗 + 去饱和 */
    float wet = clamp(uWeather, 0.0, 1.0);
    sky *= 1.0 - wet * 0.45;
    sky = mix(sky, vec3(dot(sky, vec3(0.299, 0.587, 0.114))), wet * 0.35);
    vec2 qv = uv - 0.5;
    sky *= 1.0 - dot(qv, qv) * 0.35;
    sky += (hash21(gl_FragCoord.xy) - 0.5) * (1.5 / 255.0);
    fragColor = vec4(sky, 1.0);
}
`;

    /* MINI 档位：终极保底 —— 仅天空渐变 + 太阳柔光，几乎不可能编译失败 */
    const EMBED_FRAG_MINI = `
#version 300 es
precision highp float;
uniform vec2  uResolution;
uniform vec3  uSkyZenith;
uniform vec3  uSkyHorizon;
uniform vec2  uSunPos;
uniform vec3  uSunColor;
uniform float uSunElev;
uniform float uWeather;
uniform float uBeamK;
in vec2 vUv;
out vec4 fragColor;
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    float wet = clamp(uWeather, 0.0, 1.0);
    vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(clamp(uv.y, 0.0, 1.0), 0.45));
    float sunUp = smoothstep(-0.15, 0.22, uSunElev);
    float sd = length(uSunPos - gl_FragCoord.xy);
    sky += uSunColor * exp(-sd * sd * 0.0002) * 0.35 * sunUp * clamp(uBeamK, 0.0, 2.0) * (1.0 - wet * 0.8);
    sky *= 1.0 - wet * 0.4;
    fragColor = vec4(sky, 1.0);
}
`;

    /* ---------------- 北京时间太阳解算（北京 116.4074E / 39.9042N） ----------------
       hoursOverride：调节台传入的北京时间小时数（0-24 连续值），
       为 null 时跟随实际时间 —— 用于场景时间预览（日出/正午/黄昏/深夜） */
    const OBS_LAT = 39.9042 * Math.PI / 180;
    const OBS_LON = 116.4074;
    const TZ = 8;

    function solarPosition(now, hoursOverride) {
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const bj = new Date(utc + TZ * 3600 * 1000);
        const y = bj.getUTCFullYear();
        const startOfYear = Date.UTC(y, 0, 0);
        const doy = Math.floor(
            (Date.UTC(y, bj.getUTCMonth(), bj.getUTCDate()) - startOfYear) / 86400000
        );
        const hours = hoursOverride != null
            ? hoursOverride
            : bj.getUTCHours() + bj.getUTCMinutes() / 60 + bj.getUTCSeconds() / 3600;
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
            /* 首次切换提前到 ~18-30s，让访客尽快看到天气模式变化 */
            this.timer = 18 + 12 * Math.random();
        },
        /* 返回 uWeather 0..1（约 2.5s 平滑过渡）
           全天候可下雨：夜间雨幕与幽蓝人造光同屏是核心美术场景，
           不再按太阳仰角限制（旧逻辑导致夜间访客永远看不到雨） */
        update(dt) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = 45 + 45 * Math.random();
                const wantRain = Math.random() < 0.4;
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
            this.shaderTier = null;
            this.tierErrors = {};
            this.ftEma = 0.016;   // 帧时指数平滑（秒，初值 16ms）
            this.ftAcc = 0;       // 自适应评估累计器
            /* 调节台可覆盖参数（null/默认 = 跟随引擎自动逻辑） */
            this.timeOverride = null;   // 北京时间小时覆盖（null=实际时间）
            this.beamK = 1.0;           // 光束强度系数
            this.refrK = 1.0;           // 雨滴折射系数
            this.marchManual = false;   // 手动步数（关闭自适应）
            this.weatherManual = false; // 手动天气（暂停 FSM 自动切换）
            this.lastSunElev = 0;
            this.lastSunAz = 0;
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
                const detail = String((err && err.message) || err).slice(0, 500);
                console.warn("[RTX] 全部着色器档位编译失败，回退静态背景：", err);
                this.canvas.remove();
                this.fail("shader-fail",
                    "图形引擎着色器编译失败，已回退静态背景。如需反馈请截图：【" +
                    detail.replace(/\s+/g, " ").slice(0, 160) + "】", detail);
            });
        }

        fail(reason, message, detail) {
            this.setState("dead");
            this.failReason = reason;
            window.__rtxFail = {
                stage: reason,
                message,
                detail: detail || "",
                ua: navigator.userAgent
            };
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
            this.tierErrors = {};
            let fullFrag = EMBED_FRAG;
            if (SHADER_PATH) {
                /* 开发期可选：fetch 覆盖完整档位着色器源码 */
                fullFrag = await fetch(SHADER_PATH.frag).then((r) => r.text());
            }
            /* 三级自愈：FULL → LITE → MINI，首个编译成功的档位生效，
               用户永远不会看到"编译失败"（除非三级全挂） */
            const variants = [
                ["full", fullFrag],
                ["lite", EMBED_FRAG_LITE],
                ["mini", EMBED_FRAG_MINI]
            ];
            let lastErr = null;
            for (const [tier, fragSrc] of variants) {
                try {
                    this.linkProgram(EMBED_VERT, fragSrc);
                    this.shaderTier = tier;
                    console.log("[RTX] 着色器档位就绪:", tier);
                    return;
                } catch (err) {
                    lastErr = err;
                    /* 捕获各档位编译错误 → 调节台公示，远程排障唯一线索 */
                    this.tierErrors[tier] = String((err && err.message) || err).replace(/\s+/g, " ").slice(0, 160);
                    console.warn("[RTX] 着色器档位 " + tier + " 编译失败:", err && err.message);
                }
            }
            throw lastErr || new Error("所有着色器档位编译失败");
        }

        linkProgram(vertSrc, fragSrc) {
            const gl = this.gl;
            /* 关键：GLSL 规定 #version 必须是第一行，模板字符串的起始换行/BOM
               会被 ANGLE 等严格驱动直接判编译失败 —— 此处统一 trim 兜底 */
            const compileShader = (type, src) => {
                const s = gl.createShader(type);
                gl.shaderSource(s, String(src).trim());
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                    const log = gl.getShaderInfoLog(s);
                    gl.deleteShader(s);
                    throw new Error(String(log).slice(0, 300));
                }
                return s;
            };
            let vsH = null, fsH = null, prog = null;
            try {
                vsH = compileShader(gl.VERTEX_SHADER, vertSrc);
                fsH = compileShader(gl.FRAGMENT_SHADER, fragSrc);
                prog = gl.createProgram();
                gl.attachShader(prog, vsH);
                gl.attachShader(prog, fsH);
                gl.linkProgram(prog);
                if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                    throw new Error(String(gl.getProgramInfoLog(prog)).slice(0, 300));
                }
                this.prog = prog;
            } catch (e) {
                if (prog) gl.deleteProgram(prog);
                throw e;
            } finally {
                if (vsH) gl.deleteShader(vsH);
                if (fsH) gl.deleteShader(fsH);
            }
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
                "uWeather", "uRain", "uTheme", "uBeamK", "uRefrK", "uSteps",
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

            /* 帧时 EMA + 周期评估：仅自适应体积光步数（规范 §6 认可的
               唯一调参杠杆），分辨率/DPR 始终满血点对点 */
            this.ftEma += (dt - this.ftEma) * 0.05;
            this.ftAcc += dt;
            if (this.ftAcc > 2.0) {
                this.ftAcc = 0;
                this.tuneMarch();
            }
            this.raf = requestAnimationFrame((t) => this.frame(t));
        }

        /* 每 ~2s 依据帧时调节体积光步数：>24ms 降 16 步、<14ms 升 8 步，
           区间 16..MARCH_DEFAULT；调节台手动固定步数时跳过；
           可用 window.__yaoxiRTG.config.adaptiveMarch=false 关闭 */
        tuneMarch() {
            if (CFG.adaptiveMarch === false || this.marchManual) return;
            const ms = this.ftEma * 1000;
            const before = this.marchSteps;
            if (ms > 24 && this.marchSteps > 16) {
                this.marchSteps -= 16;
            } else if (ms < 14 && !this.software && this.marchSteps < MARCH_DEFAULT) {
                this.marchSteps = Math.min(MARCH_DEFAULT, this.marchSteps + 8);
            }
            if (this.marchSteps !== before) {
                console.log("[RTX] 自适应体积光步数:", before, "->", this.marchSteps,
                    "帧时≈" + ms.toFixed(1) + "ms");
            }
        }

        update(dt, time) {
            const gl = this.gl;
            const u = this.uniforms;
            const now = new Date();
            /* 调节台时间覆盖：非 null 时按指定北京时间小时数解算太阳 */
            const solar = solarPosition(now, this.timeOverride);
            this.lastSunElev = solar.elevation;
            this.lastSunAz = solar.azimuth;

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

            /* 天气状态机（全天候双模；调节台手动时冻结 FSM 输出） */
            const weather = this.weatherManual ? this.wfsm.smooth : this.wfsm.update(dt);
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
            gl.uniform1f(u.uBeamK, this.beamK);   /* LITE/MINI 无此 uniform → location null 静默忽略 */
            gl.uniform1f(u.uRefrK, this.refrK);
            gl.uniform1i(u.uSteps, Math.max(8, Math.min(128, this.marchSteps | 0)));
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

        /* ---------------- 调节台公共 API ---------------- */

        /* 实时数值读出（数值渲染）：FPS/帧时/档位/天气/太阳/分辨率 */
        getStats() {
            return {
                running: this.state === "ready",
                fps: this.ftEma > 0 ? Math.round(1 / this.ftEma) : 0,
                ftMs: +(this.ftEma * 1000).toFixed(1),
                tier: this.shaderTier || "--",
                march: this.marchSteps,
                marchManual: this.marchManual,
                weather: +this.wfsm.smooth.toFixed(2),
                weatherManual: this.weatherManual,
                sunElev: +(this.lastSunElev * 180 / Math.PI).toFixed(1),
                sunAz: +(this.lastSunAz * 180 / Math.PI).toFixed(0),
                bjHours: this.timeOverride,
                res: this.width + "x" + this.height,
                dpr: this.dpr,
                software: this.software
            };
        }

        /* 手动天气混合值 0..1（冻结 FSM 自动切换） */
        setWeatherValue(v) {
            const x = Math.max(0, Math.min(1, +v || 0));
            this.weatherManual = true;
            this.wfsm.smooth = x;
            this.wfsm.target = x;
        }

        /* 恢复 FSM 自动天气 */
        setWeatherAuto() {
            this.weatherManual = false;
            this.wfsm.target = 0;
            this.wfsm.timer = Math.min(this.wfsm.timer, 12);
        }

        /* 时间覆盖（北京小时 0-24；null = 跟随实际时间） */
        setTimeOverride(hours) {
            this.timeOverride = hours == null ? null : Math.max(0, Math.min(24, +hours || 0));
        }

        /* 手动固定体积光步数（关闭自适应），null 恢复自适应 */
        setMarchManual(n) {
            if (n == null) {
                this.marchManual = false;
            } else {
                this.marchManual = true;
                this.setMarch(n);
            }
        }

        setBeamK(v) { this.beamK = Math.max(0, Math.min(2, +v || 0)); }
        setRefrK(v) { this.refrK = Math.max(0, Math.min(3, +v || 0)); }

        /* 一键恢复引擎默认（自动天气/实际时间/自适应步数/默认强度） */
        resetScene() {
            this.setWeatherAuto();
            this.setTimeOverride(null);
            this.setMarchManual(null);
            this.marchSteps = MARCH_DEFAULT;
            this.setBeamK(1);
            this.setRefrK(1);
        }

        setMarch(n) { this.marchSteps = Math.max(8, Math.min(128, n | 0)); }
        setWeather(weather) {
            this.wfsm.target = weather === "rain" ? this.wfsm.states.RAIN : this.wfsm.states.CLEAR;
        }
    }

    /* ---------------- 场景调节台控制器（导航栏入口） ----------------
       · 滑杆 ↔ 引擎 API 双向绑定：自动模式下滑杆实时跟随 FSM/自适应输出
       · 数值读出 2.5Hz 轮询刷新（面板开启时才轮询，关闭即停，零闲时开销）
       · 用户自定义持久化 localStorage("yaoxiSceneCfg")；"恢复默认"即清除
       · 引擎未就绪（rtx-fallback）时自动禁用控制区，读出显示引擎状态 */
    const SCENE_STORE_KEY = "yaoxiSceneCfg";

    function initScenePanel(rtx) {
        const $ = (id) => document.getElementById(id);
        const panel = $("scenePanel");
        const toggleBtn = $("sceneToggle");
        if (!panel || !toggleBtn) return;

        const el = {
            close: $("sceneClose"),
            ctlWeather: $("ctlWeather"), vWeather: $("vWeather"), ctlWeatherAuto: $("ctlWeatherAuto"),
            ctlTime: $("ctlTime"), vTime: $("vTime"), ctlTimeAuto: $("ctlTimeAuto"),
            ctlMarch: $("ctlMarch"), vMarch: $("vMarch"), ctlMarchAuto: $("ctlMarchAuto"),
            ctlBeam: $("ctlBeam"), vBeam: $("vBeam"),
            ctlRefr: $("ctlRefr"), vRefr: $("vRefr"),
            reset: $("ctlReset"),
            stMode: $("stMode"), stFps: $("stFps"), stTier: $("stTier"),
            stMarch: $("stMarch"), stWeather: $("stWeather"),
            stSun: $("stSun"), stRes: $("stRes"),
            tierHint: $("tierHint")
        };

        /* 动态数值标签多语言（静态文案由 main.js i18n 扫描翻译） */
        const L10N = {
            "zh-CN": {
                auto: "自动", follow: "跟随本地", steps: (n) => n + " 步", manual: "手动",
                run: "运行中", sw: "运行中·软渲", dead: "引擎未运行", az: "方位",
                tierHint: "当前 {TIER} 档位（GPU 驱动兼容降级）：雨幕粒子、雨滴折射与体积光步数不可用；天气滑杆调节天色明暗，光束强度作用于太阳光晕。",
                swHint: " 当前为软件渲染，帧率受限。",
                fullErr: " FULL 档编译失败："
            },
            "zh-TW": {
                auto: "自動", follow: "跟隨本地", steps: (n) => n + " 步", manual: "手動",
                run: "運行中", sw: "運行中·軟渲", dead: "引擎未運行", az: "方位",
                tierHint: "目前 {TIER} 檔位（GPU 驅動相容降級）：雨幕粒子、雨滴折射與體積光步數不可用；天氣滑桿調節天色明暗，光束強度作用於太陽光暈。",
                swHint: " 目前為軟體渲染，幀率受限。",
                fullErr: " FULL 檔編譯失敗："
            },
            "en": {
                auto: "Auto", follow: "Local", steps: (n) => n + " steps", manual: "manual",
                run: "Running", sw: "Running·SW", dead: "Engine offline", az: "az",
                tierHint: "{TIER} tier (driver-compat fallback): rain streaks, rain refraction and ray steps unavailable; the weather slider dims the sky, the beam slider scales the sun glow.",
                swHint: " Software rendering; FPS is limited.",
                fullErr: " FULL tier compile failed: "
            }
        };
        const L = () => L10N[document.documentElement.lang] || L10N["zh-CN"];

        const num = (v, d, lo, hi) => {
            const x = +v;
            return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d;
        };
        const fmtHours = (h) => {
            let hh = Math.floor(h), mm = Math.round((h - hh) * 60);
            if (mm >= 60) { mm = 0; hh += 1; }
            return String(hh % 24).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
        };

        let timer = 0;              /* 读出轮询句柄 */
        const dragging = new Set(); /* 拖动中的滑杆：自动跟随不反写，避免打断用户 */

        /* ----- 持久化 ----- */
        const save = () => {
            try {
                localStorage.setItem(SCENE_STORE_KEY, JSON.stringify({
                    w: +el.ctlWeather.value, wAuto: el.ctlWeatherAuto.checked,
                    t: +el.ctlTime.value, tAuto: el.ctlTimeAuto.checked,
                    m: +el.ctlMarch.value, mAuto: el.ctlMarchAuto.checked,
                    beam: +el.ctlBeam.value, refr: +el.ctlRefr.value
                }));
            } catch (e) { /* 存储不可用（隐私模式）→ 静默降级为会话级 */ }
        };
        const restore = () => {
            let cfg = null;
            try { cfg = JSON.parse(localStorage.getItem(SCENE_STORE_KEY) || "null"); } catch (e) { cfg = null; }
            if (!cfg) return;
            el.ctlWeatherAuto.checked = cfg.wAuto !== false;
            el.ctlTimeAuto.checked = cfg.tAuto !== false;
            el.ctlMarchAuto.checked = cfg.mAuto !== false;
            el.ctlWeather.value = num(cfg.w, 0, 0, 1);
            el.ctlTime.value = num(cfg.t, 12, 0, 24);
            el.ctlMarch.value = num(cfg.m, MARCH_DEFAULT, 16, 128);
            el.ctlBeam.value = num(cfg.beam, 1, 0, 2);
            el.ctlRefr.value = num(cfg.refr, 1, 0, 3);
            rtx.setBeamK(+el.ctlBeam.value);
            rtx.setRefrK(+el.ctlRefr.value);
            if (!el.ctlWeatherAuto.checked) rtx.setWeatherValue(+el.ctlWeather.value);
            if (!el.ctlTimeAuto.checked) rtx.setTimeOverride(+el.ctlTime.value);
            if (!el.ctlMarchAuto.checked) rtx.setMarchManual(+el.ctlMarch.value);
        };

        /* ----- 数值读出渲染（面板开启期间 2.5Hz） ----- */
        function syncStats() {
            const s = rtx.getStats();
            const alive = !!s.running;
            const t = L();
            panel.classList.toggle("is-dead", !alive);

            /* 档位自适应提示：非 FULL 档自动置灰失效控件（折射/步数），
               并公示降级原因 + FULL 编译错误（远程排障唯一线索） */
            const tierLite = alive && s.tier !== "full";
            panel.classList.toggle("tier-lite", tierLite);
            const setNa = (input, na) => {
                if (input) input.closest(".ctl-block").classList.toggle("is-na", na);
            };
            setNa(el.ctlMarch, tierLite);
            setNa(el.ctlRefr, tierLite);
            let hint = "";
            if (tierLite) hint += t.tierHint.replace("{TIER}", String(s.tier).toUpperCase());
            if (alive && s.software) hint += t.swHint;
            if (tierLite && rtx.tierErrors && rtx.tierErrors.full) hint += t.fullErr + rtx.tierErrors.full;
            if (el.tierHint) {
                el.tierHint.hidden = !hint;
                el.tierHint.textContent = hint;
            }

            const ctrls = [el.ctlWeather, el.ctlWeatherAuto, el.ctlTime, el.ctlTimeAuto,
                el.ctlMarch, el.ctlMarchAuto, el.ctlBeam, el.ctlRefr, el.reset];
            for (const c of ctrls) if (c) c.disabled = !alive;

            el.stMode.textContent = alive ? (s.software ? t.sw : t.run) : t.dead;
            el.stFps.textContent = alive ? s.fps + " fps / " + s.ftMs + " ms" : "--";
            el.stTier.textContent = alive ? String(s.tier).toUpperCase() : "--";
            el.stMarch.textContent = alive ? t.steps(s.march) + (s.marchManual ? " · " + t.manual : "") : "--";
            el.stWeather.textContent = alive
                ? s.weather.toFixed(2) + (s.weatherManual ? "" : " · " + t.auto) : "--";
            el.stSun.textContent = alive
                ? (s.sunElev >= 0 ? "+" : "") + s.sunElev.toFixed(1) + "° / " + t.az + " " + s.sunAz + "°" : "--";
            el.stRes.textContent = alive ? s.res + " @" + s.dpr + "x" : "--";

            /* 自动模式：滑杆实时跟随引擎输出（拖动中除外） */
            if (alive) {
                if (el.ctlWeatherAuto.checked && !dragging.has(el.ctlWeather)) {
                    el.ctlWeather.value = s.weather;
                }
                if (el.ctlMarchAuto.checked && !dragging.has(el.ctlMarch)) {
                    el.ctlMarch.value = s.march;
                }
            }
            el.vWeather.textContent = el.ctlWeatherAuto.checked ? t.auto : (+el.ctlWeather.value).toFixed(2);
            el.vMarch.textContent = t.steps(+el.ctlMarch.value);
            el.vTime.textContent = el.ctlTimeAuto.checked ? t.follow : fmtHours(+el.ctlTime.value);
            el.vBeam.textContent = (+el.ctlBeam.value).toFixed(2);
            el.vRefr.textContent = (+el.ctlRefr.value).toFixed(2);
        }

        /* ----- 开合（aria 同步 + 轮询生命周期） ----- */
        function openPanel() {
            panel.classList.add("is-open");
            panel.setAttribute("aria-hidden", "false");
            toggleBtn.classList.add("is-on");
            toggleBtn.setAttribute("aria-expanded", "true");
            syncStats();
            if (!timer) timer = setInterval(syncStats, 400);
        }
        function closePanel() {
            panel.classList.remove("is-open");
            panel.setAttribute("aria-hidden", "true");
            toggleBtn.classList.remove("is-on");
            toggleBtn.setAttribute("aria-expanded", "false");
            if (timer) { clearInterval(timer); timer = 0; }
        }

        toggleBtn.addEventListener("click", () =>
            panel.classList.contains("is-open") ? closePanel() : openPanel());
        if (el.close) el.close.addEventListener("click", closePanel);
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && panel.classList.contains("is-open")) {
                closePanel();
                toggleBtn.focus();
            }
        });

        /* ----- 滑杆 → 引擎 ----- */
        for (const input of [el.ctlWeather, el.ctlMarch]) {
            if (!input) continue;
            input.addEventListener("pointerdown", () => dragging.add(input));
            window.addEventListener("pointerup", () => dragging.delete(input));
            window.addEventListener("pointercancel", () => dragging.delete(input));
        }

        /* 拖动天气滑杆 → 冻结 FSM 手动定值；勾回"自动天气"→ 恢复 FSM */
        el.ctlWeather.addEventListener("input", () => {
            el.ctlWeatherAuto.checked = false;
            rtx.setWeatherValue(+el.ctlWeather.value);
            save();
        });
        el.ctlWeatherAuto.addEventListener("change", () => {
            if (el.ctlWeatherAuto.checked) rtx.setWeatherAuto();
            else rtx.setWeatherValue(+el.ctlWeather.value);
            save();
        });

        /* 时间覆盖：拖动即固定北京时间（太阳/色温立即重解算）；勾回跟随实际时间 */
        el.ctlTime.addEventListener("input", () => {
            el.ctlTimeAuto.checked = false;
            rtx.setTimeOverride(+el.ctlTime.value);
            save();
        });
        el.ctlTimeAuto.addEventListener("change", () => {
            rtx.setTimeOverride(el.ctlTimeAuto.checked ? null : +el.ctlTime.value);
            save();
        });

        /* 步数：拖动即固定（关闭自适应）；勾回自适应 */
        el.ctlMarch.addEventListener("input", () => {
            el.ctlMarchAuto.checked = false;
            rtx.setMarchManual(+el.ctlMarch.value);
            save();
        });
        el.ctlMarchAuto.addEventListener("change", () => {
            if (el.ctlMarchAuto.checked) rtx.setMarchManual(null);
            else rtx.setMarchManual(+el.ctlMarch.value);
            save();
        });

        el.ctlBeam.addEventListener("input", () => { rtx.setBeamK(+el.ctlBeam.value); save(); });
        el.ctlRefr.addEventListener("input", () => { rtx.setRefrK(+el.ctlRefr.value); save(); });

        el.reset.addEventListener("click", () => {
            rtx.resetScene();
            el.ctlWeatherAuto.checked = true;
            el.ctlTimeAuto.checked = true;
            el.ctlMarchAuto.checked = true;
            el.ctlMarch.value = MARCH_DEFAULT;
            el.ctlBeam.value = 1;
            el.ctlRefr.value = 1;
            try { localStorage.removeItem(SCENE_STORE_KEY); } catch (e) { /* 同 save */ }
            syncStats();
        });

        restore();
        syncStats();
    }

    /* ---------------- 启动 ---------------- */
    function boot() {
        const rtx = new RTXBackground();
        window.__rtx = rtx;
        rtx.wfsm.init();
        rtx.boot();
        initScenePanel(rtx);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
