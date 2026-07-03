import type { GatewayEvent } from '@hermes/shared'

import type { HermesConnection } from '@/global'
import type { HermesGateway } from '@/hermes'

export interface TerminalSessionInfo {
  id: string
  shell?: string
}

export interface TerminalApi {
  dispose: (id: string) => Promise<unknown>
  onData: (id: string, handler: (data: string) => void) => () => void
  onExit: (id: string, handler: () => void) => () => void
  resize: (id: string, size: { cols: number; rows: number }) => Promise<unknown>
  start: (options: { cols: number; cwd: string; rows: number }) => Promise<TerminalSessionInfo>
  write: (id: string, data: string) => Promise<unknown>
}

interface RemoteTerminalEventPayload {
  data?: string
  exitCode?: number | null
  id?: string
}

const noopUnsubscribe = () => undefined

function localTerminalApi(): TerminalApi | null {
  return window.hermesDesktop?.terminal ?? null
}

function remoteTerminalApi(gateway: HermesGateway | null | undefined): TerminalApi | null {
  if (!gateway) {
    return null
  }

  return {
    dispose: id => gateway.request('desktop_terminal.dispose', { id }),
    onData: (id, handler) =>
      gateway.on('desktop_terminal.data', (event: GatewayEvent<RemoteTerminalEventPayload>) => {
        if (event.payload?.id === id) {
          handler(event.payload.data ?? '')
        }
      }),
    onExit: (id, handler) =>
      gateway.on('desktop_terminal.exit', (event: GatewayEvent<RemoteTerminalEventPayload>) => {
        if (event.payload?.id === id) {
          handler()
        }
      }),
    resize: (id, size) => gateway.request('desktop_terminal.resize', { id, ...size }),
    start: options => gateway.request<TerminalSessionInfo>('desktop_terminal.start', options),
    write: (id, data) => gateway.request('desktop_terminal.write', { data, id })
  }
}

export function terminalApiForConnection(
  connection: HermesConnection | null | undefined,
  gateway: HermesGateway | null | undefined
): TerminalApi | null {
  if (connection?.mode === 'remote') {
    return remoteTerminalApi(gateway)
  }

  return localTerminalApi()
}

export { noopUnsubscribe }
