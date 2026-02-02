import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import App from './App'
import { SETTINGS_STORAGE_KEY } from './utils/localStorage'
import { DEFAULT_SETTINGS } from './types'

describe('App', () => {
  beforeEach(() => {
    // Clear localStorage and reset document classes before each test
    localStorage.clear()
    document.documentElement.classList.remove('theme-light', 'theme-dark')
  })

  afterEach(() => {
    cleanup()
  })

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

  describe('theme class application', () => {
    it('applies theme-light class when theme is light', () => {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'light' })
      )
      render(<App />)
      expect(document.documentElement.classList.contains('theme-light')).toBe(true)
      expect(document.documentElement.classList.contains('theme-dark')).toBe(false)
    })

    it('applies theme-dark class when theme is dark', () => {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'dark' })
      )
      render(<App />)
      expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
      expect(document.documentElement.classList.contains('theme-light')).toBe(false)
    })

    it('applies no theme class when theme is system', () => {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'system' })
      )
      render(<App />)
      expect(document.documentElement.classList.contains('theme-light')).toBe(false)
      expect(document.documentElement.classList.contains('theme-dark')).toBe(false)
    })
  })
})
