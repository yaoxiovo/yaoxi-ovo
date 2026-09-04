#version 300 es
/* ============================================================
   yaoxi.wiki — 全屏 WebGL2 物理光追 / 全天候环境光引擎
   顶点着色器：单 Draw Call 全屏大三角形（3 顶点覆盖整屏）
   - 避免 2 三角形对角线的栅格化冗余
   - 全部 3D 计算下沉到片元，顶点仅透传 UV / NDC
   ============================================================ */
precision highp float;

layout(location = 0) in vec2 aPos;   // (-1,-1),(3,-1),(-1,3)

out vec2 vUv;                        // 0..1

void main() {
    vec2 p = aPos;
    vUv = p * 0.5 + 0.5;
    gl_Position = vec4(p, 0.0, 1.0);
}
