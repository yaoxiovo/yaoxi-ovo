/**
 * yaoxi.wiki - WebGL 2.0 Physical Volumetric & All-Weather Lighting Engine
 * Architecture Target: Mali-G615-MC6 / FP16 Native Throughput
 * Full-screen single triangle, zero VBO allocation, branchless GLSL ES 3.00
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    root.SkyEngineScheduler = exports.SkyEngineScheduler;
    root.VERTEX_SHADER_SOURCE = exports.VERTEX_SHADER_SOURCE;
    root.FRAGMENT_SHADER_SOURCE = exports.FRAGMENT_SHADER_SOURCE;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

out vec2 v_uv;
out vec2 v_ndc;

void main() {
    // 0: (-1.0, -1.0), 1: (3.0, -1.0), 2: (-1.0, 3.0)
    // Full screen triangle covering [-1, 1] without diagonal quad overlap
    vec2 vertices[3] = vec2[3](
        vec2(-1.0, -1.0),
        vec2( 3.0, -1.0),
        vec2(-1.0,  3.0)
    );

    vec2 pos = vertices[gl_VertexID];
    v_ndc = pos;
    v_uv = pos * 0.5 + 0.5;
    gl_Position = vec4(pos, 0.0, 1.0);
}
`;

  const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

in vec2 v_uv;
in vec2 v_ndc;
out vec4 fragColor;

uniform mediump vec2  u_resolution;      // Physical pixel resolution (Native DPR 100%)
uniform mediump float u_time;            // Elapsed time in seconds
uniform mediump float u_scroll;          // DOM scroll offset in physical pixels
uniform mediump vec2  u_mouse;           // Cursor / Touch position in physical pixels
uniform mediump vec3  u_sun_dir;         // Sun direction unit vector (calculated by UTC+8)
uniform mediump vec3  u_zenith_col;      // Zenith ambient color (Color temp LERP)
uniform mediump vec3  u_horizon_col;     // Horizon atmosphere color (Rayleigh scattering)
uniform mediump vec3  u_sun_col;         // Direct solar light color
uniform mediump float u_weather_mode;    // 0.0 = Sunny (Volumetric God-rays/GGX), 1.0 = Rain (Ripples/Refraction)

const float PI = 3.141592653589793;

// Fast pseudo-random hash (FP16 optimized)
mediump float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// 2D Value Noise
mediump float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// Henyey-Greenstein Atmospheric Phase Function approximation
mediump float henyeyGreenstein(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

// Sunny Mode: 64-step full volumetric raymarching & Brownian micro-dust
mediump vec3 renderVolumetricSunny(vec3 rayDir, vec2 screenUV, float scrollOffset) {
    float cosTheta = dot(rayDir, normalize(u_sun_dir));
    float phase = henyeyGreenstein(cosTheta, 0.76);

    vec2 uvParallax = screenUV + vec2(0.0, scrollOffset * 0.00035);

    mediump float accumScattering = 0.0;
    mediump float stepSize = 1.0 / 64.0;
    mediump float marchDist = 0.0;

    float dither = hash21(screenUV * u_resolution + fract(u_time));
    marchDist += dither * stepSize;

    for (int i = 0; i < 64; ++i) {
        vec3 p = rayDir * marchDist;
        vec2 sampleP = (p.xy + uvParallax * 2.0) * rot(0.2);
        float density = vnoise(sampleP * 3.5 + vec2(u_time * 0.04, 0.0));
        density = smoothstep(0.38, 0.85, density);

        accumScattering += density * stepSize;
        marchDist += stepSize;
    }

    vec3 godRays = u_sun_col * accumScattering * phase * 4.2;

    // Brownian motion micro-dust particles
    vec2 dustCoord = screenUV * 12.0 + vec2(sin(u_time * 0.2), cos(u_time * 0.3) + scrollOffset * 0.001);
    float dust = vnoise(dustCoord * 4.0);
    dust = pow(dust, 8.0) * 8.0 * clamp(cosTheta, 0.0, 1.0);

    // Fresnel rim light
    float rimFresnel = pow(1.0 - clamp(dot(vec3(0.0, 0.0, 1.0), rayDir), 0.0, 1.0), 3.0);
    vec3 rimLight = u_sun_col * rimFresnel * max(u_sun_dir.y, 0.0) * 0.5;

    return godRays + (u_sun_col * dust) + rimLight;
}

// Rainy Mode: procedural ripples, streaks & splash particles
mediump vec3 renderRainyRefraction(vec2 screenUV, float scrollOffset, out vec3 outNormal) {
    vec2 uv = screenUV;
    uv.y += scrollOffset * 0.0006;

    // Voronoi raindrop ripples
    vec2 p = uv * vec2(18.0, 10.0);
    vec2 id = floor(p);
    vec2 gv = fract(p) - 0.5;

    float dropTime = u_time * 2.2 + hash21(id) * 6.28;
    float ringProgress = fract(dropTime * 0.8);
    float dist = length(gv);

    float ripple = sin((dist - ringProgress * 0.5) * 28.0) * exp(-dist * 4.0) * (1.0 - ringProgress);
    ripple *= step(0.0, ringProgress);

    // Vertical rain streaks
    vec2 streakCoord = uv * vec2(30.0, 3.0) + vec2(0.0, u_time * 3.5);
    float streak = vnoise(streakCoord);
    streak = smoothstep(0.65, 0.95, streak) * 0.25;

    // Screen-space normal perturbation
    vec2 dN = vec2(
        vnoise(uv * 40.0 + vec2(0.01, 0.0)) - vnoise(uv * 40.0 - vec2(0.01, 0.0)),
        vnoise(uv * 40.0 + vec2(0.0, 0.01)) - vnoise(uv * 40.0 - vec2(0.0, 0.01))
    ) * 0.35;

    dN += (gv / (dist + 0.001)) * ripple * 0.6;
    dN.y -= streak * 0.5;

    outNormal = normalize(vec3(dN, 1.0));

    // Splashes along horizontal interface edges
    float splashNoise = vnoise(vec2(screenUV.x * 60.0, u_time * 12.0));
    float splashLine = smoothstep(0.03, 0.0, abs(fract(screenUV.y * 3.0 + scrollOffset * 0.0004) - 0.01));
    float splashMask = splashNoise * splashLine * 0.8;

    return vec3(splashMask);
}

// Dual-light source microfacet GGX reflection
mediump vec3 evaluateLighting(vec3 N, vec3 V, vec3 L_sun, vec3 L_cursor, vec3 baseCol) {
    vec3 H_sun = normalize(V + L_sun);
    float NdotL_sun = max(dot(N, L_sun), 0.0);
    float NdotH_sun = max(dot(N, H_sun), 0.0);
    float rough = 0.35;
    float a = rough * rough;
    float a2 = a * a;
    float denomSun = (NdotH_sun * NdotH_sun * (a2 - 1.0) + 1.0);
    float D_sun = a2 / (PI * denomSun * denomSun + 0.0001);

    vec3 H_cur = normalize(V + L_cursor);
    float NdotL_cur = max(dot(N, L_cursor), 0.0);
    float NdotH_cur = max(dot(N, H_cur), 0.0);
    float denomCur = (NdotH_cur * NdotH_cur * (a2 - 1.0) + 1.0);
    float D_cur = a2 / (PI * denomCur * denomCur + 0.0001);

    float F0 = 0.04;
    float F_sun = F0 + (1.0 - F0) * pow(1.0 - max(dot(V, H_sun), 0.0), 5.0);
    float F_cur = F0 + (1.0 - F0) * pow(1.0 - max(dot(V, H_cur), 0.0), 5.0);

    vec3 specSun = u_sun_col * (D_sun * F_sun * NdotL_sun);
    vec3 specCur = vec3(0.6, 0.8, 1.0) * (D_cur * F_cur * NdotL_cur) * 2.5;

    return baseCol + specSun + specCur;
}

void main() {
    vec2 screenUV = gl_FragCoord.xy / u_resolution.xy;
    vec2 ndc = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
    ndc.x *= (u_resolution.x / u_resolution.y);

    vec3 rayDir = normalize(vec3(ndc * 0.6, 1.0));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    // 1. Atmosphere base gradient
    float skyGradient = clamp(screenUV.y + (u_scroll * 0.0002), 0.0, 1.0);
    vec3 ambientSky = mix(u_horizon_col, u_zenith_col, pow(skyGradient, 0.7));

    // 2. Sunny volumetric radiance
    vec3 sunnyRadiance = renderVolumetricSunny(rayDir, screenUV, u_scroll);

    // 3. Rainy surface ripples & normals
    vec3 perturbedNormal;
    vec3 rainSplashes = renderRainyRefraction(screenUV, u_scroll, perturbedNormal);

    vec3 N = mix(vec3(0.0, 0.0, 1.0), perturbedNormal, u_weather_mode);

    // 4. Cursor light direction
    vec2 mouseNDC = (u_mouse / u_resolution.xy) * 2.0 - 1.0;
    mouseNDC.x *= (u_resolution.x / u_resolution.y);
    mouseNDC.y = -mouseNDC.y;
    vec3 cursorLightDir = normalize(vec3(mouseNDC - ndc, 0.35));

    // 5. Dual-source lighting
    vec3 litSky = evaluateLighting(N, viewDir, normalize(u_sun_dir), cursorLightDir, ambientSky);

    // 6. Branchless weather mix
    vec3 finalColor = mix(litSky + sunnyRadiance, litSky * 0.75 + rainSplashes, u_weather_mode);

    // 7. Micro-prism chromatic aberration
    float caStrength = 0.0025 * (1.0 + u_weather_mode * 1.5);
    finalColor.r += vnoise((screenUV + vec2(caStrength, 0.0)) * 60.0) * 0.03;
    finalColor.b += vnoise((screenUV - vec2(caStrength, 0.0)) * 60.0) * 0.03;

    // 8. 8-bit Anti-banding dither
    float dither = (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
    finalColor += dither;

    fragColor = vec4(finalColor, 1.0);
}
`;

  class SkyEngineScheduler {
    constructor(canvasId = 'webgl-sky-engine', guardId = 'gl-fallback-guard') {
      this.canvasId = canvasId;
      this.guardId = guardId;
      this.canvas = null;
      this.guard = null;
      this.gl = null;
      this.program = null;
      this.vao = null;
      this.uniforms = {};

      this.startTime = performance.now();
      this.dpr = 1.0;
      this.scrollCurrent = 0.0;
      this.scrollTarget = 0.0;
      this.mouseX = 0.0;
      this.mouseY = 0.0;
      this.targetMouseX = 0.0;
      this.targetMouseY = 0.0;

      this.weatherMode = 0.0;
      this.targetWeatherMode = 0.0;
      this.rafId = 0;
    }

    sniffAndInitContext() {
      this.canvas = document.getElementById(this.canvasId);
      this.guard = document.getElementById(this.guardId);
      if (!this.canvas) return false;

      const gl = this.canvas.getContext('webgl2', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        desynchronized: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      });

      if (!gl) {
        this.triggerFallbackGuard();
        return false;
      }

      this.gl = gl;
      return true;
    }

    triggerFallbackGuard() {
      if (this.guard) {
        this.guard.style.display = 'flex';
      }
      console.error('[SkyEngine] Modern WebGL 2.0 core required. Fallback guard triggered.');
    }

    compileShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`[SkyEngine] Shader compilation failed: ${log}`);
      }
      return shader;
    }

    initProgram() {
      const gl = this.gl;
      const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`[SkyEngine] Program link failed: ${gl.getProgramInfoLog(program)}`);
      }

      this.program = program;
      gl.useProgram(program);

      const uniformNames = [
        'u_resolution', 'u_time', 'u_scroll', 'u_mouse',
        'u_sun_dir', 'u_zenith_col', 'u_horizon_col',
        'u_sun_col', 'u_weather_mode'
      ];
      uniformNames.forEach((name) => {
        this.uniforms[name] = gl.getUniformLocation(program, name);
      });

      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
    }

    resize() {
      if (!this.gl || !this.canvas) return;
      this.dpr = window.devicePixelRatio || 1.0;
      const physicalWidth = Math.round(window.innerWidth * this.dpr);
      const physicalHeight = Math.round(window.innerHeight * this.dpr);

      if (this.canvas.width !== physicalWidth || this.canvas.height !== physicalHeight) {
        this.canvas.width = physicalWidth;
        this.canvas.height = physicalHeight;
        this.gl.viewport(0, 0, physicalWidth, physicalHeight);
      }
    }

    evaluateBeijingSolarAtmosphere() {
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const beijingTime = new Date(utcTime + 8 * 3600000);

      const hours = beijingTime.getHours();
      const minutes = beijingTime.getMinutes();
      const seconds = beijingTime.getSeconds();
      const millis = beijingTime.getMilliseconds();
      const dayProgress = (hours * 3600 + minutes * 60 + seconds + millis / 1000.0) / 86400.0;

      const solarAngle = (dayProgress - 0.5) * 2.0 * Math.PI;
      const sunDir = [
        Math.sin(solarAngle) * 0.8,
        Math.sin(dayProgress * Math.PI) * 1.2 - 0.2,
        Math.cos(solarAngle) * 0.6
      ];

      let zenithCol, horizonCol, sunCol;

      if (dayProgress >= 0.20 && dayProgress < 0.28) {
        // 04:48 - 06:43 Dawn (3000K warm/cool interweave)
        const t = (dayProgress - 0.20) / 0.08;
        zenithCol = this.lerpVec3([0.08, 0.12, 0.25], [0.18, 0.28, 0.52], t);
        horizonCol = this.lerpVec3([0.45, 0.18, 0.22], [0.92, 0.48, 0.32], t);
        sunCol = [1.0, 0.55, 0.35];
      } else if (dayProgress >= 0.28 && dayProgress < 0.70) {
        // 06:43 - 16:48 Midday direct light (6500K crisp white)
        const t = (dayProgress - 0.28) / 0.42;
        const middayWeight = Math.sin(t * Math.PI);
        zenithCol = this.lerpVec3([0.18, 0.32, 0.62], [0.12, 0.38, 0.85], middayWeight);
        horizonCol = this.lerpVec3([0.65, 0.72, 0.85], [0.78, 0.85, 0.95], middayWeight);
        sunCol = [1.0, 0.98, 0.92];
      } else if (dayProgress >= 0.70 && dayProgress < 0.80) {
        // 16:48 - 19:12 Dusk / Sunset (Rayleigh scattering golden red)
        const t = (dayProgress - 0.70) / 0.10;
        zenithCol = this.lerpVec3([0.15, 0.22, 0.45], [0.08, 0.10, 0.22], t);
        horizonCol = this.lerpVec3([0.95, 0.42, 0.22], [0.55, 0.15, 0.18], t);
        sunCol = [1.0, 0.42, 0.18];
      } else {
        // 19:12 - 04:48 Midnight starlight (Deep blue artificial tone)
        zenithCol = [0.04, 0.07, 0.14];
        horizonCol = [0.08, 0.12, 0.22];
        sunCol = [0.15, 0.25, 0.45];
      }

      return { sunDir, zenithCol, horizonCol, sunCol };
    }

    lerpVec3(a, b, t) {
      return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
      ];
    }

    bindEvents() {
      this.scrollTarget = window.scrollY;
      this.scrollCurrent = window.scrollY;
      this.targetMouseX = (window.innerWidth * 0.5) * this.dpr;
      this.targetMouseY = (window.innerHeight * 0.5) * this.dpr;
      this.mouseX = this.targetMouseX;
      this.mouseY = this.targetMouseY;

      window.addEventListener('resize', () => this.resize(), { passive: true });

      window.addEventListener('scroll', () => {
        this.scrollTarget = window.scrollY;
      }, { passive: true });

      window.addEventListener('pointermove', (e) => {
        this.targetMouseX = e.clientX * this.dpr;
        this.targetMouseY = e.clientY * this.dpr;
      }, { passive: true });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'W') {
          this.targetWeatherMode = this.targetWeatherMode > 0.5 ? 0.0 : 1.0;
          console.log(`[SkyEngine] Weather toggle: ${this.targetWeatherMode === 1.0 ? 'Rainy' : 'Sunny'}`);
        }
      });
    }

    render() {
      const gl = this.gl;
      if (!gl) return;

      const now = performance.now();
      const elapsed = (now - this.startTime) / 1000.0;

      this.scrollCurrent += (this.scrollTarget - this.scrollCurrent) * 0.08;
      this.mouseX += (this.targetMouseX - this.mouseX) * 0.1;
      this.mouseY += (this.targetMouseY - this.mouseY) * 0.1;
      this.weatherMode += (this.targetWeatherMode - this.weatherMode) * 0.03;

      const atmo = this.evaluateBeijingSolarAtmosphere();

      gl.useProgram(this.program);

      gl.uniform2f(this.uniforms.u_resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uniforms.u_time, elapsed);
      gl.uniform1f(this.uniforms.u_scroll, this.scrollCurrent * this.dpr);
      gl.uniform2f(this.uniforms.u_mouse, this.mouseX, this.mouseY);
      gl.uniform3fv(this.uniforms.u_sun_dir, atmo.sunDir);
      gl.uniform3fv(this.uniforms.u_zenith_col, atmo.zenithCol);
      gl.uniform3fv(this.uniforms.u_horizon_col, atmo.horizonCol);
      gl.uniform3fv(this.uniforms.u_sun_col, atmo.sunCol);
      gl.uniform1f(this.uniforms.u_weather_mode, this.weatherMode);

      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      this.rafId = requestAnimationFrame(() => this.render());
    }

    start() {
      if (!this.sniffAndInitContext()) return;
      this.initProgram();
      this.resize();
      this.bindEvents();
      this.render();
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this.gl && this.program) {
        this.gl.deleteProgram(this.program);
      }
    }
  }

  // Auto-init helper when mounted in DOM
  if (typeof document !== 'undefined') {
    const autoInit = () => {
      if (document.getElementById('webgl-sky-engine') && !root.__skyEngine) {
        try {
          const engine = new SkyEngineScheduler('webgl-sky-engine', 'gl-fallback-guard');
          engine.start();
          root.__skyEngine = engine;
        } catch (e) {
          console.error('[SkyEngine] Auto init failed:', e);
        }
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      autoInit();
    }
  }

  return {
    SkyEngineScheduler,
    VERTEX_SHADER_SOURCE,
    FRAGMENT_SHADER_SOURCE
  };
}));
