import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the chat interface', () => {
    render(<App />)
    expect(screen.getByText('Azure OpenAI Chat')).toBeInTheDocument()
    expect(screen.getByLabelText('Open settings')).toBeInTheDocument()
    expect(screen.getByLabelText('Message input')).toBeInTheDocument()
  })

  it('shows configuration prompt when not configured', () => {
    render(<App />)
    expect(
      screen.getByText('Configure your Azure OpenAI settings to get started')
    ).toBeInTheDocument()
  })
})
