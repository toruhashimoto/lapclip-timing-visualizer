import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AnalysisPreview } from './components/analysis/AnalysisPreview'
import './index.css'

// ?mock=analysis previews the analysis tab on synthetic data.
const analysis = new URLSearchParams(location.search).get('mock') === 'analysis'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{analysis ? <AnalysisPreview /> : <App />}</StrictMode>,
)
