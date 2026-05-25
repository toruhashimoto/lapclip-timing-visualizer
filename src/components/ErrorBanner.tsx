import { formatClock } from '../utils/formatTime'

type Props = {
  error: string
  lastFetchedAt: string | null
  onRetry: () => void
  onDismiss: () => void
}

export function ErrorBanner({ error, lastFetchedAt, onRetry, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-red-800 bg-red-950/60 px-4 py-2.5 text-sm"
    >
      <span className="font-semibold text-red-300">
        Failed to fetch latest data.
      </span>
      <span className="text-red-200/80">
        {lastFetchedAt
          ? `Showing previous result from ${formatClock(lastFetchedAt)}.`
          : 'No previous data to show.'}
      </span>
      <span className="text-red-200/50">{error}</span>
      <div className="ml-auto flex gap-2">
        <button
          onClick={onRetry}
          className="rounded-md border border-red-700 px-2 py-0.5 text-xs font-medium text-red-200 hover:bg-red-900/60"
        >
          Retry
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md px-2 py-0.5 text-xs text-red-300/70 hover:text-red-200"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
