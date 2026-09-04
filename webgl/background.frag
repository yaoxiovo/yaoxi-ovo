#version 300 es
/* ============================================================
   yaoxi.wiki — 全屏 WebGL2 物理光追 / 全天候环境光引擎
   片元着色器
   ─────────────────────────────────────────────────────────
   · precision mediump float —— Mali-G615 FP16 双倍吞吐
   · 单 Pass 直接输出默认帧缓冲（无 FBO / 无中间纹理 / 无回读）
   · 无分支数学：mix / smoothstep / step
   · 编译友好（移动驱动）：
     ① 体积光循环用非恒定界 uSteps（ES3.00 合法）→ 驱动不展开，
        避免 64 步 × 多层噪声展开后超 Mali/Adreno 指令上限而编译失败
     ② 玻璃共享项（双光源 GGX / 干涉 / 色散采样）提出 8 卡片循环外
     ③ 体积光束仅计算一次，bg 与玻璃折射采样共用
   ============================================================ */
precision mediump float;

uniform vec2  uResolution;   // 设备像素 (cssW*dpr, cssH*dpr)
uniform vec2  uSunPos;       // 太阳屏幕投影点（设备像素，夜间可越界）
uniform vec3  uSunDir;       // 归一化太阳方向（视空间，+Y 向上）
uniform vec3  uSunColor;     // 太阳主光颜色（北京时间色温三次样条）
uniform vec3  uSkyZenith;    // 天顶大气色
uniform vec3  uSkyHorizon;   // 地平线大气色
uniform vec3  uAmbient;      // 环境光
uniform vec3  uGround;       // 地表色
uniform float uSunElev;      // 太阳仰角（弧度）
uniform float uTime;         // 秒
uniform float uScrollY;      // 垂直滚动位移（设备像素，仅标量 Uniform 传滚动）
uniform float uDPR;          // 设备像素比
uniform float uWeather;      // 0 晴天 ~ 1 雨天（状态机平滑过渡）
uniform float uRain;         // 雨量强度
uniform float uTheme;        // 0 深色 ~ 1 浅色
uniform int   uSteps;        // 体积光步数（非恒定循环界，默认 64）
uniform int   uCardCount;    // 参与光路的玻璃卡片数（<= 8）
uniform vec4  uCards[8];     // 卡片矩形（设备像素 x,y,w,h）
uniform vec2  uCursor;       // 光标位置（设备像素）
uniform float uCursorL;      // 光标辅助光强度 0..1

in vec2 vUv;
out vec4 fragColor;

/* ---------- 哈希 / 值噪声（无分支） ---------- */
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

/* ---------- 大气层（瑞利散射简化：天顶/地平线双色梯度） ---------- */
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

/* ---------- 晴天：体积光追（丁达尔光束） ----------
   非恒定循环界 uSteps：驱动不展开、可控运行时步数，兼顾编译与性能 */
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
    return beam * sunUp * clearK * 0.55;
}

/* ---------- 晴天：布朗运动微尘 ---------- */
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

/* ---------- 雨天：多层程序化雨丝 ---------- */
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

/* ---------- 雨天：多层程序化涟漪 → 法线扰动/折射畸变 ---------- */
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

/* ---------- 玻璃卡片几何 ---------- */
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

/* ============================================================ */
void main() {
    vec2 px = gl_FragCoord.xy;
    float sunUp = smoothstep(-0.05, 0.25, uSunElev);
    float clearK = (1.0 - uWeather);

    /* 视差解算：全局大气随垂直滚动整体偏移（仅标量 Uniform uScrollY） */
    vec2 basePx = px + vec2(0.0, uScrollY * 0.16);

    /* 晴天/雨天双模：涟漪法线扰动 + 透光折射畸变 */
    vec2 dp = basePx / uResolution.y;
    vec2 rip = ripples(dp, uTime);
    vec2 refr = rip * (14.0 * uRain);

    /* 体积光束仅算一次，bg 与玻璃折射共用（防驱动展开多份重循环） */
    vec3 beam = godRays(basePx);
    vec3 bg = skyBase(basePx) + beam + dust(basePx, sunUp, clearK);
    vec3 atmoRefr = skyBase(px + refr) + beam + dust(px + refr, sunUp, clearK);

    float streak = rainStreaks(dp, uTime);
    vec3 rainBg = atmoRefr * (0.86 + 0.20 * streak) + uAmbient * 0.10;
    bg = mix(bg, rainBg, uWeather);

    /* ---- 玻璃卡片材质（共享项提出循环外） ---- */
    vec3 tint = mix(vec3(0.55, 0.65, 0.82), vec3(0.93, 0.96, 1.0), uTheme);
    float glassA = mix(0.88, 0.72, uTheme);
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 N = normalize(vec3(rip * 0.5, 1.0));
    float NoV = max(dot(N, V), 0.0);
    float roug = 0.34;
    float a2 = roug * roug * roug * roug;
    float dispK = mix(0.5, 1.8, uRain) * (0.3 + 0.7 * sunUp);

    /* 太阳主光 + 光标辅助光 双光源 GGX + 薄膜干涉（不依赖卡片矩形） */
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

    /* RGB 三通道波长分离（微棱镜色散），仅 3 次廉价 skyBase */
    vec3 chroma = vec3(0.0);
    chroma.r = skyBase(px + refr + vec2(3.0, 0.0)).r;
    chroma.g = skyBase(px + refr + vec2(0.0, 0.0)).g;
    chroma.b = skyBase(px + refr + vec2(-3.0, 0.0)).b;
    vec3 dispersion = (chroma - atmoRefr) * dispK;

    /* 逐卡片累积（循环界 uCardCount，驱动不展开） */
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

    /* 微弱暗角 */
    vec2 qv = px / uResolution - 0.5;
    final *= 1.0 - dot(qv, qv) * 0.35;

    /* 抗色阶抖动（与 CSS SVG 噪点叠加） */
    final += (hash21(px) - 0.5) * (1.5 / 255.0);

    fragColor = vec4(final, 1.0);
}
