import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bricolage-grotesque/500.css'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/bricolage-grotesque/800.css'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import '@fontsource/noto-nastaliq-urdu/500.css'
import './index.css'
import './styles/theme-guard.generated.css'
import './styles/theme-buttons.css'
import App from './App.jsx'
import { initButtonLabels } from './utils/buttonLabels'

// Expose and log build version in console
fetch('/version.json')
  .then(res => res.json())
  .then(ver => {
    window.__SHOPPYOS_VERSION__ = ver;
    console.log(`%c[ShoppyOS] Build ${ver.shortHash} (${ver.branch}) · ${ver.buildTime}`, 'color: #0F4D3A; font-weight: bold; background: #E6F3EE; padding: 2px 6px; border-radius: 4px;');
  })
  .catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

initButtonLabels()
