import type { JprrCategory, JprrCategoryKey } from '../mockJprrData'

type Props = {
  categories: JprrCategory[]
  active: JprrCategoryKey
  onSelect: (key: JprrCategoryKey) => void
}

// Category tab bar for the ?mock=jprr preview (全日本ロード). Lets you flip
// between the synthetic Men Elite / MM / Men U23 / Women Elite+WU23 / WM fields.
export function CategoryTabs({ categories, active, onSelect }: Props) {
  return (
    <div
      role="tablist"
      aria-label="全日本ロード カテゴリ（プレビュー）"
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1.5"
    >
      <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Mock
      </span>
      {categories.map((c) => {
        const on = c.key === active
        return (
          <button
            key={c.key}
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(c.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              on
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
