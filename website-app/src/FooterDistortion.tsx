import { useEffect, useRef } from "react";
import * as THREE from "three";
import textureUrl from "./assets/footer-texture.png";

/**
 * Trae 同款 Footer Low-Poly 碎片扭曲动画。
 * 实现要点（对照 Trae 官网反解）：
 * - PlaneGeometry(1,1,14,14)：15x15 网格细分
 * - DataTexture(RG/Float)：每帧在 CPU 端更新网格顶点位移（常态波浪 + 衰减 + 鼠标冲击）
 * - ShaderMaterial：片段着色按位移偏移采样文字纹理，产生碎片扭曲观感
 * - 外层占位容器维持文档流高度，内层 position:fixed; bottom:0 吸附视口底部
 * - prefers-reduced-motion 时降级为静态纹理
 */
interface FooterDistortionProps {
  grid?: number;
  mouseRadius?: number;
  strength?: number;
  relaxation?: number;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uTexture;
  uniform sampler2D uDataTexture;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    vec4 offset = texture2D(uDataTexture, vUv);
    // 按网格位移采样，碎片化的文字扭曲
    gl_FragColor = texture2D(uTexture, uv - 0.02 * offset.rg);
  }
`;

const FooterDistortion = ({
  grid = 15,
  mouseRadius = 0.25,
  strength = 0.15,
  relaxation = 0.9,
}: FooterDistortionProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer | null = null;
    let camera: THREE.OrthographicCamera | null = null;
    let scene: THREE.Scene | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let dataTexture: THREE.DataTexture | null = null;
    let data: Float32Array | null = null;
    let mesh: THREE.Mesh | null = null;
    let rafId = 0;
    let disposed = false;
    const mountRect = () => mount.getBoundingClientRect();

    const resize = () => {
      if (!renderer || !camera || !mesh) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      mesh.scale.set(w, h, 1);
    };

    const mouse = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };

    const onPointerMove = (e: MouseEvent) => {
      const rect = mountRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1 - (e.clientY - rect.top) / rect.height;
      // pointermove 与 mousemove 双监听会各触发一次，坐标未变化时跳过，避免 velocity 被置零
      if (nx === mouse.x && ny === mouse.y) return;
      velocity.x = nx - mouse.x;
      velocity.y = ny - mouse.y;
      mouse.x = nx;
      mouse.y = ny;
    };

    const onPointerEnter = (e: MouseEvent) => {
      // 进入 canvas 时同步坐标并清零速度，避免首次移动把 (0,0)→当前位置当作巨大位移
      const rect = mountRect();
      if (rect.width === 0 || rect.height === 0) return;
      mouse.x = (e.clientX - rect.left) / rect.width;
      mouse.y = 1 - (e.clientY - rect.top) / rect.height;
      velocity.x = 0;
      velocity.y = 0;
    };

    const onPointerLeave = () => {
      velocity.x = 0;
      velocity.y = 0;
    };

    const init = () => {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      // 对称正交视野（中心在原点），与 PlaneGeometry(1,1)（中心同为原点）对齐：
      // 若视野取 [0,w]x[0,h]，mesh 将只与视野重叠四分之一，文字会被推出画布（偏左贴边）
      camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1000, 1000);
      camera.position.z = 2;

      // 网格顶点位移数据：RG 通道每纹素 2 个 float，初始随机 ±125（碎片状起步）
      data = new Float32Array(2 * grid * grid);
      for (let i = 0; i < grid * grid; i++) {
        data[i * 2] = 255 * Math.random() - 125;
        data[i * 2 + 1] = 255 * Math.random() - 125;
      }
      dataTexture = new THREE.DataTexture(
        data,
        grid,
        grid,
        THREE.RGFormat,
        THREE.FloatType
      );
      dataTexture.needsUpdate = true;

      material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: {
          uTexture: { value: new THREE.TextureLoader().load(textureUrl) },
          uDataTexture: { value: dataTexture },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
      });

      const geometry = new THREE.PlaneGeometry(1, 1, grid - 1, grid - 1);
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      resize();
      // pointermove 与 mousemove 双监听，兼容部分环境（如自动化测试）只派发 mousemove 的情况
      mount.addEventListener("pointermove", onPointerMove);
      mount.addEventListener("mousemove", onPointerMove);
      mount.addEventListener("pointerenter", onPointerEnter);
      mount.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("resize", resize);

      if (prefersReduced) {
        // 无障碍降级：清零位移后渲染一帧完整清晰的静态文字
        if (data) data.fill(0);
        if (dataTexture) dataTexture.needsUpdate = true;
        renderer.render(scene, camera);
        return;
      }

      const tick = () => {
        if (disposed || !material || !data || !dataTexture || !renderer || !scene || !camera) return;
        rafId = requestAnimationFrame(tick);
        // 位移逐帧衰减：静止时收敛为完整清晰的 diffsense 文字
        for (let i = 0; i < grid * grid; i++) {
          data[i * 2] *= relaxation;
          data[i * 2 + 1] *= relaxation;
        }
        // 鼠标速度冲击作用半径内的顶点
        const mx = grid * mouse.x;
        const my = grid * mouse.y;
        const r = grid * mouseRadius;
        for (let m = 0; m < grid; m++) {
          for (let n = 0; n < grid; n++) {
            const dx = mx - m;
            const dy = my - n;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < r * r) {
              const force = Math.min(r / Math.max(Math.sqrt(dist2), 0.001), 10);
              data[(m + n * grid) * 2] += 100 * strength * velocity.x * force;
              data[(m + n * grid) * 2 + 1] -= 100 * strength * velocity.y * force;
            }
          }
        }
        dataTexture.needsUpdate = true;
        renderer.render(scene, camera);
        // 冲击每帧消费一次，鼠标停住后不再持续施力
        velocity.x = 0;
        velocity.y = 0;
      };
      rafId = requestAnimationFrame(tick);
    };

    // 纹理本地导入，直接初始化
    init();

    const cleanup = () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("mousemove", onPointerMove);
      mount.removeEventListener("pointerenter", onPointerEnter);
      mount.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", resize);
      material?.dispose();
      dataTexture?.dispose();
      mesh?.geometry.dispose();
      renderer?.dispose();
      if (renderer && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };

    return cleanup;
  }, [grid, mouseRadius, strength, relaxation]);

  return <div ref={mountRef} className="distortion-canvas" />;
};

export default FooterDistortion;