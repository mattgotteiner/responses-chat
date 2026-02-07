/**
 * File Search Settings component for managing vector stores and files
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Settings, VectorStore, VectorStoreFile, VectorStoreCache } from '../../types';
import { FILE_SEARCH_EXPIRATION_OPTIONS, DEFAULT_FILE_SEARCH_EXPIRATION_MINUTES } from '../../types';
import { createAzureClient } from '../../utils/api';
import {
  listVectorStores,
  createVectorStore,
  deleteVectorStore,
  getVectorStoreFiles,
  uploadFileToVectorStore,
  deleteFileFromVectorStore,
  formatFileSize,
  getExpirationStatus,
} from '../../utils/vectorStore';
import './FileSearchSettings.css';

interface FileSearchSettingsProps {
  /** Current settings */
  settings: Settings;
  /** Handler to update settings */
  onUpdateSettings: (updates: Partial<Settings>) => void;
  /** Vector store cache */
  vectorStoreCache: VectorStoreCache;
  /** Update cached vector stores list */
  setVectorStores: (stores: VectorStore[]) => void;
  /** Update cached files for a store */
  setStoreFiles: (storeId: string, files: VectorStoreFile[]) => void;
  /** Set loading state for a store's files */
  setStoreFilesLoading: (storeId: string, isLoading: boolean) => void;
}

/** Supported file types for vector store upload */
const SUPPORTED_FILE_TYPES = [
  '.pdf', '.txt', '.md', '.html', '.json', '.csv',
  '.doc', '.docx', '.pptx', '.xlsx'
].join(',');

/**
 * File Search Settings component
 */
export function FileSearchSettings({ settings, onUpdateSettings, vectorStoreCache, setVectorStores: setCachedVectorStores, setStoreFiles: setCachedStoreFiles, setStoreFilesLoading }: FileSearchSettingsProps) {
  // Vector stores state - initialized from cache
  const [vectorStores, setVectorStoresLocal] = useState<VectorStore[]>(vectorStoreCache.stores);
  const [isLoadingStoresLocal, setIsLoadingStoresLocal] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);

  // Combined loading state (from cache or local refresh)
  const isLoadingStores = vectorStoreCache.isStoresLoading || isLoadingStoresLocal;

  // Sync local stores when cache changes
  useEffect(() => {
    setVectorStoresLocal(vectorStoreCache.stores);
  }, [vectorStoreCache.stores]);

  // Wrapper to update both local state and cache
  const setVectorStores = useCallback((stores: VectorStore[] | ((prev: VectorStore[]) => VectorStore[])) => {
    setVectorStoresLocal(prev => {
      const newStores = typeof stores === 'function' ? stores(prev) : stores;
      setCachedVectorStores(newStores);
      return newStores;
    });
  }, [setCachedVectorStores]);

  // Selected store's files - initialized from cache
  const [files, setFilesLocal] = useState<VectorStoreFile[]>(
    settings.fileSearchVectorStoreId ? (vectorStoreCache.storeFiles[settings.fileSearchVectorStoreId] ?? []) : []
  );
  const [isLoadingFilesLocal, setIsLoadingFilesLocal] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Combined loading state (from cache or local)
  const isLoadingFiles = isLoadingFilesLocal || 
    (settings.fileSearchVectorStoreId ? vectorStoreCache.loadingStoreFiles.has(settings.fileSearchVectorStoreId) : false);

  // Wrapper to update both local state and cache
  const setFiles = useCallback((files: VectorStoreFile[] | ((prev: VectorStoreFile[]) => VectorStoreFile[])) => {
    setFilesLocal(prev => {
      const newFiles = typeof files === 'function' ? files(prev) : files;
      if (settings.fileSearchVectorStoreId) {
        setCachedStoreFiles(settings.fileSearchVectorStoreId, newFiles);
      }
      return newFiles;
    });
  }, [settings.fileSearchVectorStoreId, setCachedStoreFiles]);

  // Create store form state
  const [isCreating, setIsCreating] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreExpiration, setNewStoreExpiration] = useState(
    settings.fileSearchExpirationMinutes ?? DEFAULT_FILE_SEARCH_EXPIRATION_MINUTES
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingFileIds, setDeletingFileIds] = useState<Set<string>>(new Set());

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Check if we have valid credentials
  const hasValidCredentials = Boolean(settings.endpoint && settings.apiKey);

  // Sync local files when cache changes (e.g., when files are loaded)
  useEffect(() => {
    if (settings.fileSearchVectorStoreId) {
      const cachedFiles = vectorStoreCache.storeFiles[settings.fileSearchVectorStoreId];
      if (cachedFiles) {
        setFilesLocal(cachedFiles);
      }
    }
  }, [settings.fileSearchVectorStoreId, vectorStoreCache.storeFiles]);

  // Load files when selected store changes (only if not cached)
  useEffect(() => {
    if (!settings.fileSearchVectorStoreId || !hasValidCredentials) {
      setFilesLocal([]);
      return;
    }

    // Use cached files if available
    const cachedFiles = vectorStoreCache.storeFiles[settings.fileSearchVectorStoreId];
    if (cachedFiles) {
      setFilesLocal(cachedFiles);
      return;
    }

    // Skip if already loading (from cache or local)
    if (vectorStoreCache.loadingStoreFiles.has(settings.fileSearchVectorStoreId)) {
      return;
    }

    const storeId = settings.fileSearchVectorStoreId;

    const loadFiles = async () => {
      setIsLoadingFilesLocal(true);
      setStoreFilesLoading(storeId, true);
      setFilesError(null);
      try {
        const client = createAzureClient(settings);
        const storeFiles = await getVectorStoreFiles(client, storeId);
        setFiles(storeFiles);
      } catch (err) {
        setFilesError(err instanceof Error ? err.message : 'Failed to load files');
        setStoreFilesLoading(storeId, false);
      } finally {
        setIsLoadingFilesLocal(false);
      }
    };

    loadFiles();
    // We intentionally only depend on credential and store ID changes, not the entire settings object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.fileSearchVectorStoreId, hasValidCredentials, settings.endpoint, settings.apiKey]);

  // Handle vector store selection
  const handleStoreChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__create__') {
      setIsCreating(true);
      onUpdateSettings({ fileSearchVectorStoreId: undefined });
    } else {
      setIsCreating(false);
      onUpdateSettings({ fileSearchVectorStoreId: value || undefined });
    }
  }, [onUpdateSettings]);

  // Handle file selection for new store
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files;
    if (inputFiles) {
      setSelectedFiles(Array.from(inputFiles));
    }
  }, []);

  // Handle creating a new vector store
  const handleCreateStore = useCallback(async () => {
    if (!newStoreName.trim()) {
      setCreateError('Please enter a name for the vector store');
      return;
    }

    if (selectedFiles.length === 0) {
      setCreateError('Please select at least one file');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    try {
      const client = createAzureClient(settings);

      // Create the vector store
      const store = await createVectorStore(client, newStoreName.trim(), newStoreExpiration);

      // Upload files to the store
      for (const file of selectedFiles) {
        await uploadFileToVectorStore(client, store.id, file);
      }

      // Refresh the stores list
      const stores = await listVectorStores(client);
      stores.sort((a, b) => b.createdAt - a.createdAt);
      setVectorStores(stores);

      // Select the new store
      onUpdateSettings({
        fileSearchVectorStoreId: store.id,
        fileSearchExpirationMinutes: newStoreExpiration,
      });

      // Reset form
      setIsCreating(false);
      setNewStoreName('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create vector store');
    } finally {
      setIsSubmitting(false);
    }
  }, [newStoreName, newStoreExpiration, selectedFiles, settings, onUpdateSettings, setVectorStores]);

  // Handle canceling store creation
  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setNewStoreName('');
    setSelectedFiles([]);
    setCreateError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle deleting the selected vector store
  const handleDeleteStore = useCallback(async () => {
    if (!settings.fileSearchVectorStoreId) return;

    const storeId = settings.fileSearchVectorStoreId;
    const store = vectorStores.find(s => s.id === storeId);
    if (!confirm(`Delete vector store "${store?.name || 'Unknown'}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setFilesError(null);

    try {
      // Clear selection immediately for responsive UI
      onUpdateSettings({ fileSearchVectorStoreId: undefined });
      
      // Remove from local state immediately
      setVectorStores(prev => prev.filter(s => s.id !== storeId));
      setFiles([]);

      // Then delete on server
      const client = createAzureClient(settings);
      await deleteVectorStore(client, storeId);
    } catch (err) {
      // On error, refresh to get actual state
      setFilesError(err instanceof Error ? err.message : 'Failed to delete vector store');
      try {
        const client = createAzureClient(settings);
        const stores = await listVectorStores(client);
        stores.sort((a, b) => b.createdAt - a.createdAt);
        setVectorStores(stores);
      } catch {
        // Ignore refresh errors
      }
    } finally {
      setIsDeleting(false);
    }
  }, [settings, vectorStores, onUpdateSettings, setFiles, setVectorStores]);

  // Handle uploading additional files to the selected store
  const handleUploadFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files;
    if (!inputFiles || inputFiles.length === 0 || !settings.fileSearchVectorStoreId) return;

    const filesToUpload = Array.from(inputFiles);
    
    setIsUploading(true);
    setUploadError(null);
    // Show all files as uploading immediately
    setUploadingFiles(filesToUpload.map(f => f.name));

    try {
      const client = createAzureClient(settings);
      const storeId = settings.fileSearchVectorStoreId;

      for (const file of filesToUpload) {
        const uploadedFile = await uploadFileToVectorStore(client, storeId, file);
        // Add uploaded file to list and remove from uploading indicator immediately
        setFiles(prev => [...prev, uploadedFile]);
        setUploadingFiles(prev => prev.filter(name => name !== file.name));
        // Update file count in dropdown
        setVectorStores(prev => prev.map(store => 
          store.id === storeId 
            ? { ...store, fileCount: store.fileCount + 1 }
            : store
        ));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload files');
    } finally {
      setIsUploading(false);
      setUploadingFiles([]);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    }
  }, [settings, setFiles, setVectorStores]);

  // Handle deleting a file from the store
  const handleDeleteFile = useCallback(async (fileId: string, filename: string) => {
    if (!settings.fileSearchVectorStoreId) return;

    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) {
      return;
    }

    // Mark file as deleting immediately
    setDeletingFileIds(prev => new Set(prev).add(fileId));
    setFilesError(null);

    try {
      const client = createAzureClient(settings);
      await deleteFileFromVectorStore(client, settings.fileSearchVectorStoreId, fileId);

      // Remove from local state immediately
      setFiles(prev => {
        const newFiles = prev.filter(f => f.id !== fileId);
        // Update file count in dropdown
        setVectorStores(stores => stores.map(store => 
          store.id === settings.fileSearchVectorStoreId 
            ? { ...store, fileCount: newFiles.length }
            : store
        ));
        return newFiles;
      });
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'Failed to delete file');
      // On error, refresh to get actual state
      try {
        const client = createAzureClient(settings);
        const storeFiles = await getVectorStoreFiles(client, settings.fileSearchVectorStoreId!);
        setFiles(storeFiles);
      } catch {
        // Ignore refresh errors
      }
    } finally {
      setDeletingFileIds(prev => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  }, [settings, setFiles, setVectorStores]);

  // Handle refresh stores
  const handleRefreshStores = useCallback(async () => {
    if (!hasValidCredentials) return;

    setIsLoadingStoresLocal(true);
    setStoresError(null);
    try {
      const client = createAzureClient(settings);
      const stores = await listVectorStores(client);
      stores.sort((a, b) => b.createdAt - a.createdAt);
      setVectorStores(stores);
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : 'Failed to load vector stores');
    } finally {
      setIsLoadingStoresLocal(false);
    }
  }, [hasValidCredentials, settings, setVectorStores]);

  // Get currently selected store info
  const selectedStore = vectorStores.find(s => s.id === settings.fileSearchVectorStoreId);

  if (!hasValidCredentials) {
    return (
      <div className="file-search-settings">
        <div className="file-search-settings__notice">
          Configure endpoint and API key to manage vector stores.
        </div>
      </div>
    );
  }

  return (
    <div className="file-search-settings">
      {/* Store Selector */}
      <div className="file-search-settings__selector">
        <div className="file-search-settings__selector-row">
          <select
            id="vectorStoreSelect"
            className="file-search-settings__select"
            value={isCreating ? '__create__' : (settings.fileSearchVectorStoreId || '')}
            onChange={handleStoreChange}
            disabled={isLoadingStores}
          >
            <option value="">Select a vector store...</option>
            {vectorStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} ({store.fileCount} {store.fileCount === 1 ? 'file' : 'files'})
              </option>
            ))}
            <option value="__create__">+ Create new store...</option>
          </select>
          <button
            type="button"
            className="file-search-settings__refresh-btn"
            onClick={handleRefreshStores}
            disabled={isLoadingStores}
            aria-label="Refresh vector stores"
            title="Refresh vector stores"
          >
            {isLoadingStores ? '...' : '↻'}
          </button>
        </div>
        {storesError && (
          <div className="file-search-settings__error">{storesError}</div>
        )}

        {/* Warning when no store selected */}
        {!settings.fileSearchVectorStoreId && !isCreating && !isLoadingStores && (
          <div className="file-search-settings__warning">
            ⚠️ Select or create a vector store to enable file search
          </div>
        )}
      </div>

      {/* Create New Store Form */}
      {isCreating && (
        <div className="file-search-settings__create-form">
          <h4 className="file-search-settings__form-title">Create Vector Store</h4>

          <div className="file-search-settings__field">
            <label className="file-search-settings__label" htmlFor="newStoreName">
              Store Name
            </label>
            <input
              id="newStoreName"
              type="text"
              className="file-search-settings__input"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="My Documents"
              disabled={isSubmitting}
            />
          </div>

          <div className="file-search-settings__field">
            <label className="file-search-settings__label" htmlFor="newStoreExpiration">
              Expiration
            </label>
            <select
              id="newStoreExpiration"
              className="file-search-settings__select"
              value={newStoreExpiration}
              onChange={(e) => setNewStoreExpiration(Number(e.target.value))}
              disabled={isSubmitting}
            >
              {FILE_SEARCH_EXPIRATION_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <span className="file-search-settings__hint">
              Store expires after this duration of inactivity
            </span>
          </div>

          <div className="file-search-settings__field">
            <label className="file-search-settings__label">
              Files
            </label>
            <input
              ref={fileInputRef}
              type="file"
              className="file-search-settings__file-input"
              accept={SUPPORTED_FILE_TYPES}
              multiple
              onChange={handleFileSelect}
              disabled={isSubmitting}
            />
            {selectedFiles.length > 0 && (
              <div className="file-search-settings__selected-files">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="file-search-settings__selected-file">
                    <span className="file-search-settings__file-name">{file.name}</span>
                    <span className="file-search-settings__file-size">{formatFileSize(file.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {createError && (
            <div className="file-search-settings__error">{createError}</div>
          )}

          <div className="file-search-settings__actions">
            <button
              type="button"
              className="file-search-settings__cancel-btn"
              onClick={handleCancelCreate}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="file-search-settings__create-btn"
              onClick={handleCreateStore}
              disabled={isSubmitting || !newStoreName.trim() || selectedFiles.length === 0}
            >
              {isSubmitting ? 'Creating...' : 'Create Store'}
            </button>
          </div>
        </div>
      )}

      {/* Selected Store Details */}
      {selectedStore && !isCreating && (
        <div className="file-search-settings__store-details">
          <div className="file-search-settings__store-header">
            <div className="file-search-settings__store-info">
              <span className="file-search-settings__store-name">{selectedStore.name}</span>
              <span className="file-search-settings__store-expiration">
                {getExpirationStatus(selectedStore.expiresAt)}
              </span>
            </div>
            <button
              type="button"
              className="file-search-settings__delete-store-btn"
              onClick={handleDeleteStore}
              disabled={isDeleting}
              aria-label="Delete vector store"
              title="Delete vector store"
            >
              {isDeleting ? '...' : '🗑'}
            </button>
          </div>

          {/* Files List */}
          <div className="file-search-settings__files">
            <div className="file-search-settings__files-header">
              <span className="file-search-settings__files-title">Files ({files.length})</span>
              <label className="file-search-settings__upload-btn">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept={SUPPORTED_FILE_TYPES}
                  multiple
                  onChange={handleUploadFiles}
                  disabled={isUploading}
                  style={{ display: 'none' }}
                />
                {isUploading ? 'Uploading...' : '+ Add Files'}
              </label>
            </div>

            {uploadError && (
              <div className="file-search-settings__error">{uploadError}</div>
            )}

            {filesError && (
              <div className="file-search-settings__error">{filesError}</div>
            )}

            {isLoadingFiles ? (
              <div className="file-search-settings__loading">Loading files...</div>
            ) : files.length === 0 && uploadingFiles.length === 0 ? (
              <div className="file-search-settings__empty">No files in this store</div>
            ) : (
              <div className="file-search-settings__file-list">
                {/* Show files currently uploading */}
                {uploadingFiles.map((filename) => (
                  <div key={`uploading-${filename}`} className="file-search-settings__file-item file-search-settings__file-item--uploading">
                    <div className="file-search-settings__file-info">
                      <span className="file-search-settings__file-name">{filename}</span>
                      <span className="file-search-settings__file-meta file-search-settings__file-meta--uploading">
                        Uploading...
                      </span>
                    </div>
                  </div>
                ))}
                {/* Show existing files */}
                {files.map((file) => {
                  const isFileDeleting = deletingFileIds.has(file.id);
                  return (
                    <div 
                      key={file.id} 
                      className={`file-search-settings__file-item${isFileDeleting ? ' file-search-settings__file-item--deleting' : ''}`}
                    >
                      <div className="file-search-settings__file-info">
                        <span className="file-search-settings__file-name">{file.filename}</span>
                        <span className={`file-search-settings__file-meta${isFileDeleting ? ' file-search-settings__file-meta--deleting' : ''}`}>
                          {isFileDeleting ? 'Deleting...' : (
                            <>
                              {formatFileSize(file.bytes)}
                              {file.status !== 'completed' && ` • ${file.status}`}
                            </>
                          )}
                        </span>
                      </div>
                      {!isFileDeleting && (
                        <button
                          type="button"
                          className="file-search-settings__file-delete"
                          onClick={() => handleDeleteFile(file.id, file.filename)}
                          aria-label={`Delete ${file.filename}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
