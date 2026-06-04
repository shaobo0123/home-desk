const hasWindow = () => typeof window !== 'undefined'
const formatHostname = (hostname: string) => (hostname.includes(':') ? `[${hostname}]` : hostname)

export const getCurrentHostPrefix = () => {
  if (!hasWindow()) {
    return ''
  }

  return `${window.location.protocol}//${formatHostname(window.location.hostname)}`
}

export const buildCurrentHostUrl = (port: string | number) => {
  const normalizedPort = String(port).trim()
  const prefix = getCurrentHostPrefix()

  return prefix && normalizedPort ? `${prefix}:${normalizedPort}` : ''
}

export const isValidPort = (port: string | number) => {
  const normalizedPort = String(port).trim()
  const portNumber = Number(normalizedPort)

  return (
    /^\d+$/.test(normalizedPort) &&
    Number.isInteger(portNumber) &&
    portNumber >= 1 &&
    portNumber <= 65535
  )
}
