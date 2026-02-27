/**
 * Tests for FileSearchSettings component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileSearchSettings } from './FileSearchSettings';
import type { Settings, VectorStore, VectorStoreFile, VectorStoreCache } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';

// Store mock implementations for dynamic control
const mockListVectorStores = vi.fn();
const mockGetVectorStoreFiles = vi.fn();
const mockUploadFileToVectorStore = vi.fn();
const mockDeleteFileFromVectorStore = vi.fn();
const mockDeleteVectorStore = vi.fn();

// Mock the vector store utilities to avoid actual API calls
vi.mock('../../utils/vectorStore', () => ({
  listVectorStores: (...args: unknown[]) => mockListVectorStores(...args),
  createVectorStore: vi.fn(),
  deleteVectorStore: (...args: unknown[]) => mockDeleteVectorStore(...args),
  getVectorStoreFiles: (...args: unknown[]) => mockGetVectorStoreFiles(...args),
  uploadFileToVectorStore: (...args: unknown[]) => mockUploadFileToVectorStore(...args),
  deleteFileFromVectorStore: (...args: unknown[]) => mockDeleteFileFromVectorStore(...args),
  formatFileSize: (bytes: number) => `${bytes} B`,
  getExpirationStatus: () => 'No expiration',
  MAX_VECTOR_STORE_FILE_SIZE: 1024 * 1024 * 1024, // 1 GB
}));

// Mock the api utility
vi.mock('../../utils/api', () => ({
  createAzureClient: vi.fn().mockReturnValue({}),
}));

describe('FileSearchSettings', () => {
  const defaultSettings: Settings = {
    ...DEFAULT_SETTINGS,
    endpoint: '',
    apiKey: '',
  };

  const validSettings: Settings = {
    ...DEFAULT_SETTINGS,
    endpoint: 'https://test.openai.azure.com',
    apiKey: 'test-api-key',
  };

  const mockOnUpdateSettings = vi.fn();
  const mockSetVectorStores = vi.fn();
  const mockSetStoreFiles = vi.fn();
  const mockSetStoreFilesLoading = vi.fn();
  
  const emptyCache: VectorStoreCache = {
    stores: [],
    storeFiles: {},
    storesFetchedAt: null,
    isStoresLoading: false,
    loadingStoreFiles: new Set(),
  };

  // Helper to create a cache with stores pre-populated (simulates pre-fetch)
  const createCache = (
    stores: VectorStore[] = [],
    storeFiles: Record<string, VectorStoreFile[]> = {}
  ): VectorStoreCache => ({
    stores,
    storeFiles,
    storesFetchedAt: stores.length > 0 ? Date.now() : null,
    isStoresLoading: false,
    loadingStoreFiles: new Set(),
  });

  // Helper to render with default cache props
  const renderFileSearchSettings = (settings: Settings, cache: VectorStoreCache = emptyCache) => {
    return render(
      <FileSearchSettings
        settings={settings}
        onUpdateSettings={mockOnUpdateSettings}
        vectorStoreCache={cache}
        setVectorStores={mockSetVectorStores}
        setStoreFiles={mockSetStoreFiles}
        setStoreFilesLoading={mockSetStoreFilesLoading}
      />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockListVectorStores.mockResolvedValue([]);
    mockGetVectorStoreFiles.mockResolvedValue([]);
    mockUploadFileToVectorStore.mockResolvedValue({ id: 'file-1', filename: 'test.pdf', bytes: 1000, createdAt: Date.now(), status: 'completed' });
    mockDeleteFileFromVectorStore.mockResolvedValue(undefined);
    mockDeleteVectorStore.mockResolvedValue(undefined);
  });

  describe('without valid credentials', () => {
    it('shows notice to configure credentials', () => {
      renderFileSearchSettings(defaultSettings);

      expect(
        screen.getByText(/Configure endpoint and API key/)
      ).toBeInTheDocument();
    });

    it('does not show vector store selector', () => {
      renderFileSearchSettings(defaultSettings);

      expect(
        screen.queryByRole('combobox')
      ).not.toBeInTheDocument();
    });
  });

  describe('with valid credentials', () => {
    it('shows vector store selector', async () => {
      renderFileSearchSettings(validSettings);

      // Wait for the component to load
      const select = await screen.findByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('has "Create new store" option', async () => {
      renderFileSearchSettings(validSettings);

      const select = await screen.findByRole('combobox');
      expect(select).toBeInTheDocument();

      // Check for the create new option
      const options = select.querySelectorAll('option');
      const createOption = Array.from(options).find(
        opt => opt.textContent?.includes('Create new store')
      );
      expect(createOption).toBeDefined();
    });

    it('shows create form when "Create new store" is selected', async () => {
      const user = userEvent.setup();
      renderFileSearchSettings(validSettings);

      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, '__create__');

      // Check for create form elements
      expect(screen.getByText('Create Vector Store')).toBeInTheDocument();
      expect(screen.getByLabelText('Store Name')).toBeInTheDocument();
      expect(screen.getByText('Create Store')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('hides create form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderFileSearchSettings(validSettings);

      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, '__create__');

      // Click cancel
      await user.click(screen.getByText('Cancel'));

      // Create form should be hidden
      expect(screen.queryByText('Create Vector Store')).not.toBeInTheDocument();
    });

    it('disables Create Store button when name is empty', async () => {
      const user = userEvent.setup();
      renderFileSearchSettings(validSettings);

      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, '__create__');

      const createButton = screen.getByText('Create Store');
      expect(createButton).toBeDisabled();
    });

    it('has refresh button', async () => {
      renderFileSearchSettings(validSettings);

      const refreshButton = await screen.findByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('warning when no vector store selected', () => {
    it('shows warning when file search enabled but no store selected', async () => {
      const stores: VectorStore[] = [
        { id: 'vs-1', name: 'Test Store', fileCount: 2, createdAt: Date.now(), status: 'completed' },
      ];
      const cache = createCache(stores);

      renderFileSearchSettings({ ...validSettings, fileSearchVectorStoreId: undefined }, cache);

      // Wait for stores to load
      await screen.findByRole('combobox');

      // Should show warning
      expect(screen.getByText(/Select or create a vector store to enable file search/)).toBeInTheDocument();
    });

    it('does not show warning when store is selected', async () => {
      const stores: VectorStore[] = [
        { id: 'vs-1', name: 'Test Store', fileCount: 2, createdAt: Date.now(), status: 'completed' },
      ];
      const files: VectorStoreFile[] = [
        { id: 'file-1', filename: 'doc.pdf', bytes: 1000, createdAt: Date.now(), status: 'completed' },
      ];
      const cache = createCache(stores, { 'vs-1': files });

      renderFileSearchSettings({ ...validSettings, fileSearchVectorStoreId: 'vs-1' }, cache);

      // Files should be displayed immediately from cache
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();

      // Should not show warning
      expect(screen.queryByText(/Select or create a vector store/)).not.toBeInTheDocument();
    });

    it('does not show warning when creating new store', async () => {
      const user = userEvent.setup();

      renderFileSearchSettings(validSettings);

      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, '__create__');

      // Should not show warning when in create mode
      expect(screen.queryByText(/Select or create a vector store/)).not.toBeInTheDocument();
    });
  });

  describe('file upload UX', () => {
    it('shows uploading state for files being uploaded', async () => {
      const user = userEvent.setup();
      
      // Make upload slow so we can see the uploading state
      let resolveUpload: () => void;
      mockUploadFileToVectorStore.mockImplementation(() => new Promise(resolve => {
        resolveUpload = () => resolve({ id: 'file-new', filename: 'test.pdf', bytes: 1000, createdAt: Date.now(), status: 'completed' });
      }));
      
      const stores: VectorStore[] = [
        { id: 'vs-1', name: 'Test Store', fileCount: 0, createdAt: Date.now(), status: 'completed' },
      ];
      const cache = createCache(stores, { 'vs-1': [] });

      renderFileSearchSettings({ ...validSettings, fileSearchVectorStoreId: 'vs-1' }, cache);

      // Component should be loaded with store details visible
      expect(screen.getByText('+ Add Files')).toBeInTheDocument();

      // Create a file and trigger upload
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
      
      await user.upload(input, file);

      // Should show uploading state - check for the file item with uploading class
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
        // Check for the uploading file item (the span with meta--uploading class)
        const uploadingMeta = document.querySelector('.file-search-settings__file-meta--uploading');
        expect(uploadingMeta).toBeInTheDocument();
        expect(uploadingMeta?.textContent).toBe('Uploading...');
      });

      // Resolve upload
      resolveUpload!();
    });
  });

  describe('file delete UX', () => {
    it('shows deleting state for file being deleted', async () => {
      const user = userEvent.setup();
      
      // Make delete slow so we can see the deleting state
      let resolveDelete: () => void;
      mockDeleteFileFromVectorStore.mockImplementation(() => new Promise(resolve => {
        resolveDelete = () => resolve(undefined);
      }));

      const stores: VectorStore[] = [
        { id: 'vs-1', name: 'Test Store', fileCount: 1, createdAt: Date.now(), status: 'completed' },
      ];
      const files: VectorStoreFile[] = [
        { id: 'file-1', filename: 'doc.pdf', bytes: 1000, createdAt: Date.now(), status: 'completed' },
      ];
      const cache = createCache(stores, { 'vs-1': files });

      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderFileSearchSettings({ ...validSettings, fileSearchVectorStoreId: 'vs-1' }, cache);

      // File should be visible from cache
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete doc.pdf/i });
      await user.click(deleteButton);

      // Should show deleting state
      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument();
      });

      // Delete button should be hidden while deleting
      expect(screen.queryByRole('button', { name: /delete doc.pdf/i })).not.toBeInTheDocument();

      // Resolve delete
      resolveDelete!();
    });

    it('removes file from list after successful delete', async () => {
      const user = userEvent.setup();
      
      mockDeleteFileFromVectorStore.mockResolvedValue(undefined);

      const stores: VectorStore[] = [
        { id: 'vs-1', name: 'Test Store', fileCount: 2, createdAt: Date.now(), status: 'completed' },
      ];
      const files: VectorStoreFile[] = [
        { id: 'file-1', filename: 'doc.pdf', bytes: 1000, createdAt: Date.now(), status: 'completed' },
        { id: 'file-2', filename: 'other.pdf', bytes: 2000, createdAt: Date.now(), status: 'completed' },
      ];
      const cache = createCache(stores, { 'vs-1': files });

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderFileSearchSettings({ ...validSettings, fileSearchVectorStoreId: 'vs-1' }, cache);

      // Files should be visible from cache
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();
      expect(screen.getByText('other.pdf')).toBeInTheDocument();

      // Click delete button for first file
      const deleteButton = screen.getByRole('button', { name: /delete doc.pdf/i });
      await user.click(deleteButton);

      // File should be removed from list
      await waitFor(() => {
        expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument();
      });

      // Other file should still be there
      expect(screen.getByText('other.pdf')).toBeInTheDocument();
    });
  });

  describe('dropdown file count', () => {
    it('shows correct singular/plural for file count', async () => {
      const stores: VectorStore[] = [
        { id: 'vs-1', name: 'One File Store', fileCount: 1, createdAt: Date.now(), status: 'completed' },
        { id: 'vs-2', name: 'Multi File Store', fileCount: 3, createdAt: Date.now(), status: 'completed' },
      ];
      const cache = createCache(stores);

      renderFileSearchSettings(validSettings, cache);

      const select = screen.getByRole('combobox');
      const options = within(select).getAllByRole('option');

      // Find the options by their text content
      const oneFileOption = options.find(opt => opt.textContent?.includes('One File Store'));
      const multiFileOption = options.find(opt => opt.textContent?.includes('Multi File Store'));

      expect(oneFileOption?.textContent).toContain('1 file)');
      expect(oneFileOption?.textContent).not.toContain('1 files)');
      expect(multiFileOption?.textContent).toContain('3 files)');
    });
  });

  describe('vector store delete UX', () => {
    it('removes store from dropdown immediately on delete', async () => {
      const user = userEvent.setup();
      
      // Make delete slow
      let resolveDelete: () => void;
      mockDeleteVectorStore.mockImplementation(() => new Promise(resolve => {
        resolveDelete = () => resolve(undefined);
      }));

      const stores: VectorStore[] = [
        { id: 'vs-1', name: 'Store To Delete', fileCount: 1, createdAt: Date.now(), status: 'completed' },
        { id: 'vs-2', name: 'Other Store', fileCount: 2, createdAt: Date.now(), status: 'completed' },
      ];
      const files: VectorStoreFile[] = [
        { id: 'file-1', filename: 'doc.pdf', bytes: 1000, createdAt: Date.now(), status: 'completed' },
      ];
      const cache = createCache(stores, { 'vs-1': files });

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderFileSearchSettings({ ...validSettings, fileSearchVectorStoreId: 'vs-1' }, cache);

      // File should be visible from cache
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();

      // Verify store is in dropdown
      const select = screen.getByRole('combobox');
      expect(within(select).getByText(/Store To Delete/)).toBeInTheDocument();

      // Click delete store button
      const deleteStoreButton = screen.getByRole('button', { name: /delete vector store/i });
      await user.click(deleteStoreButton);

      // Store should be removed from dropdown immediately (optimistic update)
      await waitFor(() => {
        expect(within(select).queryByText(/Store To Delete/)).not.toBeInTheDocument();
      });

      // Other store should still be there
      expect(within(select).getByText(/Other Store/)).toBeInTheDocument();

      // Settings should be updated to clear selection
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ fileSearchVectorStoreId: undefined });

      // Resolve delete
      resolveDelete!();
    });
  });
});
