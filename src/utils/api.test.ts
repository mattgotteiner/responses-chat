import { describe, it, expect, vi, afterEach } from 'vitest';
import type OpenAI from 'openai';
import {
  generateMessageId,
  generateReasoningId,
  generateToolCallId,
  createAzureClient,
  uploadFileForCodeInterpreter,
  downloadContainerFile,
  triggerContainerFileDownload,
} from './api';
import { DEFAULT_SETTINGS } from '../types';

describe('API utilities', () => {
  describe('generateMessageId', () => {
    it('generates unique IDs', () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with msg_ prefix', () => {
      const id = generateMessageId();
      expect(id).toMatch(/^msg_/);
    });
  });

  describe('generateReasoningId', () => {
    it('generates unique IDs', () => {
      const id1 = generateReasoningId();
      const id2 = generateReasoningId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with reason_ prefix', () => {
      const id = generateReasoningId();
      expect(id).toMatch(/^reason_/);
    });
  });

  describe('generateToolCallId', () => {
    it('generates unique IDs', () => {
      const id1 = generateToolCallId();
      const id2 = generateToolCallId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with tool_ prefix', () => {
      const id = generateToolCallId();
      expect(id).toMatch(/^tool_/);
    });
  });

  describe('createAzureClient', () => {
    const baseSettings = {
      ...DEFAULT_SETTINGS,
      endpoint: 'https://my-resource.openai.azure.com',
      apiKey: 'test-key',
    };

    it('creates a client with normalized endpoint', () => {
      const client = createAzureClient(baseSettings);
      expect(client).toBeDefined();
      expect(client.baseURL).toBe('https://my-resource.openai.azure.com/openai/v1');
    });

    it('handles endpoint with trailing slash', () => {
      const client = createAzureClient({
        ...baseSettings,
        endpoint: 'https://my-resource.openai.azure.com/',
      });
      expect(client.baseURL).toBe('https://my-resource.openai.azure.com/openai/v1');
    });

    it('does not double-append /openai/v1', () => {
      const client = createAzureClient({
        ...baseSettings,
        endpoint: 'https://my-resource.openai.azure.com/openai/v1',
      });
      expect(client.baseURL).toBe('https://my-resource.openai.azure.com/openai/v1');
    });
  });

  describe('uploadFileForCodeInterpreter', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('throws when base64 is empty', async () => {
      const mockClient = { files: { create: vi.fn() } } as unknown as OpenAI;
      await expect(
        uploadFileForCodeInterpreter(mockClient, { filename: 'test.txt', base64: '', mimeType: 'text/plain' })
      ).rejects.toThrow('base64 data is missing or empty');
    });

    it('throws when decoded blob is empty', async () => {
      const mockClient = { files: { create: vi.fn() } } as unknown as OpenAI;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob([], { type: 'text/plain' })),
      }));
      await expect(
        uploadFileForCodeInterpreter(mockClient, { filename: 'test.txt', base64: 'dGVzdA==', mimeType: 'text/plain' })
      ).rejects.toThrow('decoded blob is empty');
    });

    it('uploads file and returns the file ID', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 'file_abc123' });
      const mockClient = { files: { create: mockCreate } } as unknown as OpenAI;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['hello'], { type: 'text/plain' })),
      }));

      const result = await uploadFileForCodeInterpreter(mockClient, {
        filename: 'hello.txt',
        base64: 'aGVsbG8=',
        mimeType: 'text/plain',
      });

      expect(result).toBe('file_abc123');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'assistants', file: expect.any(File) })
      );
      const uploadedFile = mockCreate.mock.calls[0][0].file as File;
      expect(uploadedFile.name).toBe('hello.txt');
      expect(uploadedFile.type).toBe('text/plain');
    });

    it('constructs the data URL from mimeType and base64', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 'file_csv' });
      const mockClient = { files: { create: mockCreate } } as unknown as OpenAI;
      const mockFetch = vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['a,b,c'], { type: 'text/csv' })),
      });
      vi.stubGlobal('fetch', mockFetch);

      await uploadFileForCodeInterpreter(mockClient, {
        filename: 'data.csv',
        base64: 'YSxiLGM=',
        mimeType: 'text/csv',
      });

      expect(mockFetch).toHaveBeenCalledWith('data:text/csv;base64,YSxiLGM=');
    });
  });

  describe('downloadContainerFile', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns blob on success', async () => {
      const mockBlob = new Blob(['file content'], { type: 'text/csv' });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      }));

      const result = await downloadContainerFile(
        { endpoint: 'https://my-resource.openai.azure.com', apiKey: 'test-key' },
        'container_123',
        'file_abc'
      );

      expect(result).toBe(mockBlob);
    });

    it('throws on non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }));

      await expect(
        downloadContainerFile(
          { endpoint: 'https://my-resource.openai.azure.com', apiKey: 'test-key' },
          'container_123',
          'file_abc'
        )
      ).rejects.toThrow('Failed to download file: 404 Not Found');
    });

    it('calls the correct container file URL with api-key header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob()),
      });
      vi.stubGlobal('fetch', mockFetch);

      await downloadContainerFile(
        { endpoint: 'https://my-resource.openai.azure.com', apiKey: 'my-api-key' },
        'cont_123',
        'file_456'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://my-resource.openai.azure.com/openai/v1/containers/cont_123/files/file_456/content',
        { method: 'GET', headers: { 'api-key': 'my-api-key' } }
      );
    });

    it('normalizes endpoint with trailing slash', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob()),
      });
      vi.stubGlobal('fetch', mockFetch);

      await downloadContainerFile(
        { endpoint: 'https://my-resource.openai.azure.com/', apiKey: 'key' },
        'cont_1',
        'file_1'
      );

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toBe('https://my-resource.openai.azure.com/openai/v1/containers/cont_1/files/file_1/content');
    });
  });

  describe('triggerContainerFileDownload', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('downloads the file and triggers a browser download', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(['data'], { type: 'text/csv' })),
      }));
      const mockObjectURL = 'blob:https://example.com/mock-123';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockObjectURL);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const mockClick = vi.fn();
      const mockLink = { href: '', download: '', click: mockClick };
      vi.spyOn(document, 'createElement').mockReturnValueOnce(mockLink as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      await triggerContainerFileDownload(
        { endpoint: 'https://my-resource.openai.azure.com', apiKey: 'key' },
        'cont_1',
        'file_1',
        'output.csv'
      );

      expect(mockLink.href).toBe(mockObjectURL);
      expect(mockLink.download).toBe('output.csv');
      expect(mockClick).toHaveBeenCalled();
    });

    it('passes error from downloadContainerFile through', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }));

      await expect(
        triggerContainerFileDownload(
          { endpoint: 'https://my-resource.openai.azure.com', apiKey: 'key' },
          'cont_err',
          'file_err',
          'failing.csv'
        )
      ).rejects.toThrow('Failed to download file: 500 Internal Server Error');
    });
  });
});
