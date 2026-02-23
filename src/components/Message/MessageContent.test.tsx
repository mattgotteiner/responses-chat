/**
 * Tests for MessageContent component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageContent } from './MessageContent';

describe('MessageContent', () => {
  const testContent = 'Hello **world**\n\nThis is a test.';

  describe('plaintext mode', () => {
    it('renders content as plain text preserving markdown syntax', () => {
      render(<MessageContent content={testContent} renderMode="plaintext" />);
      expect(screen.getByText(/Hello \*\*world\*\*/)).toBeInTheDocument();
    });

    it('applies plaintext container class', () => {
      const { container } = render(
        <MessageContent content={testContent} renderMode="plaintext" />
      );
      expect(container.querySelector('.message-content--plaintext')).toBeInTheDocument();
    });
  });

  describe('code mode', () => {
    it('renders content in a pre/code block', () => {
      const { container } = render(
        <MessageContent content={testContent} renderMode="code" />
      );
      expect(container.querySelector('pre')).toBeInTheDocument();
      expect(container.querySelector('code')).toBeInTheDocument();
    });

    it('applies code container class', () => {
      const { container } = render(
        <MessageContent content={testContent} renderMode="code" />
      );
      expect(container.querySelector('.message-content--code')).toBeInTheDocument();
    });

    it('contains the raw content', () => {
      render(<MessageContent content={testContent} renderMode="code" />);
      expect(screen.getByText(/Hello \*\*world\*\*/)).toBeInTheDocument();
    });
  });

  describe('markdown mode', () => {
    it('renders markdown formatting - bold text', () => {
      render(<MessageContent content="**bold**" renderMode="markdown" />);
      const bold = screen.getByText('bold');
      expect(bold.tagName.toLowerCase()).toBe('strong');
    });

    it('renders markdown formatting - italic text', () => {
      render(<MessageContent content="*italic*" renderMode="markdown" />);
      const italic = screen.getByText('italic');
      expect(italic.tagName.toLowerCase()).toBe('em');
    });

    it('applies markdown container class', () => {
      const { container } = render(
        <MessageContent content={testContent} renderMode="markdown" />
      );
      expect(container.querySelector('.message-content--markdown')).toBeInTheDocument();
    });

    it('renders lists correctly', () => {
      const listContent = '- Item 1\n- Item 2\n- Item 3';
      const { container } = render(
        <MessageContent content={listContent} renderMode="markdown" />
      );
      expect(container.querySelector('ul')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('renders code blocks', () => {
      const codeContent = '```\nconst x = 1;\n```';
      const { container } = render(
        <MessageContent content={codeContent} renderMode="markdown" />
      );
      expect(container.querySelector('pre')).toBeInTheDocument();
    });

    it('renders inline code', () => {
      const { container } = render(
        <MessageContent content="Use `console.log`" renderMode="markdown" />
      );
      expect(container.querySelector('code')).toBeInTheDocument();
      expect(screen.getByText('console.log')).toBeInTheDocument();
    });

    it('renders headings', () => {
      const { container } = render(
        <MessageContent content="# Heading 1" renderMode="markdown" />
      );
      expect(container.querySelector('h1')).toBeInTheDocument();
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
    });

    it('renders links', () => {
      const { container } = render(
        <MessageContent content="[Link text](https://example.com)" renderMode="markdown" />
      );
      const link = container.querySelector('a');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('renders GFM tables', () => {
      const tableContent = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
      const { container } = render(
        <MessageContent content={tableContent} renderMode="markdown" />
      );
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(container.querySelector('thead')).toBeInTheDocument();
      expect(container.querySelector('tbody')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('renders GFM table header cells as th elements', () => {
      const tableContent = '| Col A | Col B |\n| --- | --- |\n| val 1 | val 2 |';
      const { container } = render(
        <MessageContent content={tableContent} renderMode="markdown" />
      );
      const headers = container.querySelectorAll('th');
      expect(headers).toHaveLength(2);
      expect(headers[0].textContent).toBe('Col A');
      expect(headers[1].textContent).toBe('Col B');
    });

    it('does not render GFM tables in plaintext mode', () => {
      const tableContent = '| Name | Age |\n| --- | --- |\n| Alice | 30 |';
      const { container } = render(
        <MessageContent content={tableContent} renderMode="plaintext" />
      );
      expect(container.querySelector('table')).not.toBeInTheDocument();
    });
  });
});
