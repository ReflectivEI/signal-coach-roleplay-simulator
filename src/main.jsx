import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

function configureApiRouting() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return

  const currentOrigin = window.location.origin
  const currentHost = window.location.hostname
  const apiOrigin = 'https://reflectiv-ai.com'
  const isPrimaryOrigin = currentOrigin === apiOrigin
  const isPagesHost = currentHost === 'reflect-ai-now.pages.dev' || currentHost.endsWith('.reflect-ai-now.pages.dev')
  const isLocalHost = currentHost === 'localhost' || currentHost === '127.0.0.1'

  if (isPrimaryOrigin || (!isPagesHost && !isLocalHost)) return

  const originalFetch = window.fetch.bind(window)

  window.fetch = (input, init) => {
    if (typeof input === 'string') {
      if (input.startsWith('/api/') || input === '/manager-insights' || input === '/health') {
        return originalFetch(`${apiOrigin}${input}`, {
          ...init,
          credentials: init?.credentials ?? 'include',
        })
      }
    }

    if (input instanceof Request) {
      const url = new URL(input.url, window.location.href)
      if (url.origin === currentOrigin && (url.pathname.startsWith('/api/') || url.pathname === '/manager-insights' || url.pathname === '/health')) {
        return originalFetch(new Request(`${apiOrigin}${url.pathname}${url.search}`, input), init)
      }
    }

    return originalFetch(input, init)
  }
}

configureApiRouting()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
