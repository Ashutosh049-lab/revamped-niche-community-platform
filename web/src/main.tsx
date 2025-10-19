import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'prosemirror-view/style/prosemirror.css'
import App from './App.tsx'
import { ToastProvider } from './components/ToastProvider'

const Root = (
  import.meta.env.DEV ? (
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  ) : (
    <StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </StrictMode>
  )
)

createRoot(document.getElementById('root')!).render(Root)
