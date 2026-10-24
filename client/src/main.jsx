import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
