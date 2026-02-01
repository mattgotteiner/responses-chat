/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Enable RECORD mode to capture API responses for e2e testing */
  readonly VITE_RECORD_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
