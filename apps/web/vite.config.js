import { defineConfig, transformWithEsbuild } from 'vite'
import react from '@vitejs/plugin-react'
import { patchCssModules } from 'vite-css-modules'
import eslint from 'vite-plugin-eslint'
import { createHtmlPlugin } from 'vite-plugin-html'
import graphqlLoader from 'vite-plugin-graphql-loader'
// import htmlPurge from 'vite-plugin-html-purgecss'
import svgr from 'vite-plugin-svgr'
import dotenv from 'dotenv'
// import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const webRoot = path.dirname(fileURLToPath(import.meta.url))
const __dirname = webRoot

// Load environment variables from .env file (do not override vars set by the parent, e.g. Heroku)
dotenv.config({ path: path.join(webRoot, '.env'), override: false })

const proxyTarget = process.env.VITE_API_HOST || 'http://localhost:3001'

export default defineConfig(({ command }) => ({
  base: '/',
  envDir: webRoot,
  root: webRoot,
  define: {
    'process.env.PUBLIC_URL': JSON.stringify('')
  },
  build: {
    minify: true,
    // Gzipping every chunk to print sizes is expensive on large bundles and
    // contributed to Heroku build OOMs (~2.5GB heap limit).
    reportCompressedSize: false
  },
  plugins: [
    patchCssModules(),
    react(),
    // Skip ESLint during production builds — it adds peak memory on Heroku.
    ...(command === 'serve'
      ? [eslint({
          exclude: ['/virtual:/', 'node_modules/**'],
          failOnError: false, // Prevents Vite from stopping on lint errors
          failOnWarning: false // Ensures warnings don't block the build either
        })]
      : []),
    {
      name: 'treat-js-files-as-jsx',
      async transform (code, id) {
        if (!id.match(/src\/.*\.js$/)) return null

        // Use the exposed transform from vite, instead of directly
        // transforming with esbuild
        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic'
        })
      }
    },
    createHtmlPlugin({
      entry: 'src/index.jsx',
      template: 'index.html',
      inject: {
        data: {
          title: 'index',
          injectScript: '<script src="./inject.js"></script>'
        }
      }
    }),
    // htmlPurge(),
    svgr(),
    graphqlLoader()
  ],
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    },
    exclude: ['@hylo/shared'],
    include: ['**/*.scss']
  },
  // `vite preview` serves the built bundle instead of 1400-odd dev modules, which
  // is the difference between seconds and minutes over a relayed Tailscale link.
  // It enforces the same host check as the dev server, so it needs the same list.
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.local', '.ts.net', '.trycloudflare.com']
  },
  server: {
    // XXX: fix issues finding aliases?
    fs: {
      cachedChecks: false
    },
    port: process.env.PORT || 3000,
    // Hostnames the dev server may be reached by, beyond localhost and bare IPs
    // (which Vite allows unconditionally):
    //   .local  — Bonjour/mDNS, for a phone on the same wifi
    //   .ts.net — Tailscale MagicDNS, for a phone anywhere
    //   .trycloudflare.com — cloudflared quick tunnels, for anyone anywhere
    //     (cloudflared tunnel --url http://localhost:3000; random public URL)
    // A leading dot matches any name under that suffix, so none needs
    // per-machine configuration. Note @virtuoso.dev/message-list only treats
    // localhost and *.local as development, so the chat list carries its
    // missing-license watermark over Tailscale until VITE_VIRTUOSO_KEY is set.
    allowedHosts: ['.local', '.ts.net', '.trycloudflare.com'],
    // https: process.env.HTTPS === 'true' ? {
    //   key: fs.readFileSync(path.resolve(__dirname, `./config/ssl/${process.env.LOCAL_CERT}.key`)),
    //   cert: fs.readFileSync(path.resolve(__dirname, `./config/ssl/${process.env.LOCAL_CERT}.crt`)),
    //   ca: fs.readFileSync(path.resolve(__dirname, `./config/ssl/${process.env.LOCAL_CERT}.pem`)),
    // } : false,
    proxy: {
      // Sails serves sockets at the default socket.io path. Proxying it lets a
      // browser on another device connect through this origin — VITE_SOCKET_HOST
      // is baked into the bundle as localhost, which from a phone means the phone.
      '/socket.io': {
        target: proxyTarget,
        changeOrigin: true,
        secure: process.env.HTTPS === 'true',
        ws: true
      },
      '/noo': {
        target: proxyTarget,
        changeOrigin: true,
        secure: process.env.HTTPS === 'true',
        ws: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Browser may send Origin headers even with same-origin requests.
            // To prevent CORS issues, we have to change the Origin to match the target URL.
            if (proxyReq.getHeader('origin')) {
              proxyReq.setHeader('origin', proxyTarget)
            }
          })
          proxy.on('error', (err, req, res) => {
            const host = req.headers && req.headers.host
            console.error(
              `Proxy error: Could not proxy request ${req.url} from ${host} to ${proxyTarget}.`,
              'See https://nodejs.org/api/errors.html#errors_common_system_errors for more information',
              err.code
            )
            res.writeHead(500, {
              'Content-Type': 'text/plain'
            })
            res.end(`Proxy error: Could not proxy request ${req.url} from ${host} to ${proxyTarget} (${err.code}).`)
          })
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      client: path.resolve(__dirname, 'src/client'),
      components: path.resolve(__dirname, 'src/components'),
      config: path.resolve(__dirname, 'src/config'),
      contexts: path.resolve(__dirname, 'src/contexts'),
      css: path.resolve(__dirname, 'src/css'),
      hooks: path.resolve(__dirname, 'src/hooks'),
      '@graphql': path.resolve(__dirname, 'src/graphql'),
      router: path.resolve(__dirname, 'src/router'),
      routes: path.resolve(__dirname, 'src/routes'),
      store: path.resolve(__dirname, 'src/store'),
      sandbox: path.resolve(__dirname, 'src/sandbox'),
      tours: path.resolve(__dirname, 'src/tours'),
      util: path.resolve(__dirname, 'src/util'),
      '@hylo/contexts': path.resolve(__dirname, '../../packages/contexts'),
      '@hylo/graphql': path.resolve(__dirname, '../../packages/graphql'),
      '@hylo/hooks': path.resolve(__dirname, '../../packages/hooks'),
      '@hylo/navigation': path.resolve(__dirname, '../../packages/navigation'),
      '@hylo/presenters': path.resolve(__dirname, '../../packages/presenters/src'),
      '@hylo/shared': path.resolve(__dirname, '../../packages/shared'),
      '@hylo/urql': path.resolve(__dirname, '../../packages/urql')
    }
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]_[local]_[hash:base64:5]'
    },
    preprocessorOptions: {
      scss: {
        additionalData: '@use "./src/css/global/sass_resources.scss" as *;',
        quietDeps: true,
        logger: {
          warn: () => {}
        }
      }
    }
  }
}))
