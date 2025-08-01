import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(() => {
  // 获取环境变量，如果不存在则使用默认值
  const outDir = process.env.VITE_OUT_DIR || 'dist'
  console.log('Vite build output directory:', outDir)
  
  return {
  plugins: [react()],
    base: './', // 使用相对路径
    build: {
      outDir, // 直接使用环境变量或默认值
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: undefined, // 禁用代码分割
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      },
      cssCodeSplit: false, // 禁用CSS代码分割
      cssMinify: true, // 启用CSS压缩
      chunkSizeWarningLimit: 1000 // 提高chunk大小警告限制
    },
    css: {
      modules: {
        scopeBehaviour: 'local', // 使用局部作用域
        generateScopedName: '[name]__[local]___[hash:base64:5]' // 生成唯一的类名
      },
      postcss: {
        plugins: [
          {
            // 提高所有CSS选择器的优先级
            postcssPlugin: 'add-important',
            Declaration(decl) {
              if (!decl.value.includes('!important')) {
                decl.value = `${decl.value} !important`;
              }
            }
          }
        ]
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    }
  }
})
