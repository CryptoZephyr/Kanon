/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KANON_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
