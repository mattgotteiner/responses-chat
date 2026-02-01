import reactLogo from './assets/react.svg'
import viteLogo from '/favicon.svg'
import './App.css'
import './components/Button/Button.css'
import { Button } from './components/Button'
import { useCounter } from './hooks/useCounter'
import { formatDate } from './utils/formatDate'

function App() {
  const { count, increment, decrement, reset } = useCounter({ initialValue: 0, min: 0 })
  const today = formatDate(new Date(), { dateStyle: 'long' })

  return (
    <div className="app">
      <div>
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Hello World</h1>
      <p className="date">{today}</p>
      <div className="card">
        <p className="count">Count: {count}</p>
        <div className="button-group">
          <Button label="−" onClick={decrement} variant="secondary" />
          <Button label="+" onClick={increment} />
          <Button label="Reset" onClick={reset} variant="secondary" />
        </div>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </div>
  )
}

export default App
