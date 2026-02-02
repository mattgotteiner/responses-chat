import { useEffect } from 'react'
import './App.css'
import { SettingsProvider, useSettingsContext } from './context/SettingsContext'
import { ChatContainer } from './components/ChatContainer'

function AppContent() {
  const { settings } = useSettingsContext()

  useEffect(() => {
    const root = document.documentElement
    
    // Remove existing theme classes
    root.classList.remove('theme-light', 'theme-dark')

    if (settings.theme === 'light') {
      root.classList.add('theme-light')
    } else if (settings.theme === 'dark') {
      root.classList.add('theme-dark')
    }
    // 'system' leaves no class, allowing CSS media query fallback
  }, [settings.theme])

  return <ChatContainer />
}

function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  )
}

export default App
