import type { FeedEvent } from '../types'
import { formatClock } from '../utils/formatTime'

const KIND_STYLE: Record<FeedEvent['kind'], { color: string; tag: string }> = {
  leader: { color: 'text-purple-300', tag: 'LEAD' },
  finish: { color: 'text-emerald-300', tag: 'FIN' },
  split: { color: 'text-indigo-300', tag: '中間' },
  updated: { color: 'text-sky-300', tag: 'UPD' },
  rank: { color: 'text-yellow-300', tag: 'POS' },
  new: { color: 'text-zinc-300', tag: 'NEW' },
}

export function UpdateFeed({ events }: { events: FeedEvent[] }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Update feed
      </h2>
      {events.length === 0 ? (
        <p className="py-3 text-center text-xs text-zinc-600">
          No updates yet. New finishes and position changes appear here.
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1 font-mono text-xs">
          {events.map((e) => {
            const style = KIND_STYLE[e.kind]
            return (
              <li key={e.id} className="flex items-start gap-2 leading-relaxed">
                <span className="shrink-0 tabular-nums text-zinc-500">
                  {formatClock(e.at)}
                </span>
                <span
                  className={`shrink-0 rounded px-1 text-[10px] font-bold ${style.color} bg-zinc-800/80`}
                >
                  {style.tag}
                </span>
                <span className={`${style.color}`}>{e.text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
