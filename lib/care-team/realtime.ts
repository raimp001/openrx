import { EventEmitter } from "node:events"
import type { CareTeamEvent } from "@/lib/care-team/types"
import { CARE_TEAM_EVENT_CHANNEL } from "@/lib/care-team/constants"

interface GlobalBus {
  emitter?: EventEmitter
}

const globalBus = globalThis as unknown as GlobalBus

function getEmitter(): EventEmitter {
  if (!globalBus.emitter) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(200)
    globalBus.emitter = emitter
  }
  return globalBus.emitter
}

export function publishCareTeamEvent(event: CareTeamEvent): void {
  getEmitter().emit(CARE_TEAM_EVENT_CHANNEL, event)
}

export function subscribeCareTeamEvents(listener: (event: CareTeamEvent) => void): () => void {
  const emitter = getEmitter()
  emitter.on(CARE_TEAM_EVENT_CHANNEL, listener)

  return () => {
    emitter.off(CARE_TEAM_EVENT_CHANNEL, listener)
  }
}
