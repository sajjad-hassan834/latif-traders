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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

initButtonLabels()
