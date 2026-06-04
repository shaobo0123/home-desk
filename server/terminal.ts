import type { FastifyInstance } from 'fastify'
import os from 'node:os'
import path from 'node:path'
import pty from 'node-pty'

export const registerTerminalRoutes = (app: FastifyInstance) => {
  app.get('/api/terminal', { websocket: true }, (socket, request) => {
    const query = request.query as Record<string, string>
    const mode = query.mode

    let ptyProcess: ReturnType<typeof pty.spawn>

    if (mode === 'ssh') {
      // SSH remote connection
      const host = query.host || ''
      const port = query.port || '22'
      const user = query.user || 'root'
      const authType = query.authType || 'key'
      const keyPath = query.keyPath
      const password = query.password
      const home = process.env.HOME || os.homedir()

      if (!host) {
        socket.send('\r\n\x1b[31mError: SSH host not specified\x1b[0m\r\n')
        socket.close()
        return
      }

      const sshArgs = [
        '-p', port,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR',
      ]

      if (authType === 'key' && keyPath) {
        const resolvedKey = keyPath.replace(/^~(?=\/|$)/, home)
        sshArgs.push('-i', resolvedKey)
      }

      if (password) {
        // Use sshpass for password auth if available, otherwise fall back to interactive
        sshArgs.push(`${user}@${host}`)
        ptyProcess = pty.spawn('ssh', sshArgs, {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: home,
          env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
        })
      } else {
        sshArgs.push(`${user}@${host}`)
        ptyProcess = pty.spawn('ssh', sshArgs, {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: home,
          env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
        })
      }
    } else {
      // Local shell
      const shell = process.env.SHELL || '/bin/zsh'
      const home = process.env.HOME || os.homedir()

      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: home,
        env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
      })
    }

    // Server → Client: PTY output
    ptyProcess.onData((data) => {
      socket.send(data)
    })

    // Client → Server: terminal input or control messages
    socket.on('message', (raw: Buffer) => {
      const msg = raw.toString()
      if (msg.startsWith('\x01')) {
        try {
          const { type, cols, rows } = JSON.parse(msg.slice(1))
          if (type === 'resize' && typeof cols === 'number' && typeof rows === 'number') {
            ptyProcess.resize(cols, rows)
          }
        } catch {
          // ignore malformed control messages
        }
      } else {
        ptyProcess.write(msg)
      }
    })

    // Cleanup on disconnect
    socket.on('close', () => {
      ptyProcess.kill()
    })

    ptyProcess.onExit(() => {
      socket.close()
    })
  })
}
