/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI: {
    invoke: (channel: string, data?: any) => Promise<any>
    on: (channel: string, callback: (...args: any[]) => void) => void
    off: (channel: string) => void
  }
}
