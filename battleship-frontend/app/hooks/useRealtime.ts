'use client'

import { useEffect, useState } from 'react'
import SockJS from 'sockjs-client'
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { API_BASE } from '../lib/api'

type SubscriptionSpec = {
  topic: string | null | undefined
  onMessage: (message: IMessage) => void
}

export function useRealtime(subscriptions: SubscriptionSpec[]) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const activeSubs = subscriptions.filter((sub) => sub.topic)
    if (activeSubs.length === 0) return

    const socket = new SockJS(`${API_BASE}/ws`)
    const client = new Client({
      webSocketFactory: () => socket as WebSocket,
      reconnectDelay: 3000,
      onConnect: () => {
        setConnected(true)
        const handles: StompSubscription[] = activeSubs.map((sub) =>
          client.subscribe(sub.topic!, sub.onMessage),
        )
        ;(client as Client & { __handles?: StompSubscription[] }).__handles = handles
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
    })

    client.activate()
    return () => {
      const handles = (client as Client & { __handles?: StompSubscription[] }).__handles || []
      handles.forEach((handle) => handle.unsubscribe())
      client.deactivate()
      setConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions.map((sub) => sub.topic).join('|')])

  return connected
}
