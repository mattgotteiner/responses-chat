import './App.css'
import { SettingsProvider } from './context/SettingsContext'
import { ChatContainer } from './components/ChatContainer'

function App() {
  return (
    <SettingsProvider>
      <ChatContainer />
    </SettingsProvider>
  )
}

export default App
