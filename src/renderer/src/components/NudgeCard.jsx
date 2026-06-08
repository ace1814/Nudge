import { Check, Clock, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import dayjs from 'dayjs'

const CATEGORY_COLORS = {
  health: 'bg-emerald-500',
  work: 'bg-blue-500',
  content: 'bg-violet-500',
  personal: 'bg-amber-500',
  finance: 'bg-teal-500',
  other: 'bg-zinc-500'
}

const STATUS_BADGE = {
  pending: 'pending',
  fired: 'pending',
  done: 'done',
  missed: 'missed',
  snoozed: 'snoozed'
}

export default function NudgeCard({ nudge, onComplete, onSnooze, onDismiss, onDelete }) {
  const isDone = nudge.status === 'done'
  const isMissed = nudge.status === 'missed'
  const isOver = isDone || isMissed

  return (
    <div className={cn(
      'group flex flex-col gap-2 p-3 rounded-xl border border-border bg-card transition-all',
      isOver && 'opacity-50'
    )}>
      {/* Body */}
      <div className="flex items-start gap-3">
        <div className="mt-[6px] flex-shrink-0">
          <span className={cn('block w-2 h-2 rounded-full', CATEGORY_COLORS[nudge.category] ?? 'bg-zinc-500')} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium leading-snug text-foreground', isDone && 'line-through text-muted-foreground')}>
            {nudge.title}
          </p>
          {nudge.nudge_copy && !isDone && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{nudge.nudge_copy}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">
              {dayjs(nudge.scheduled_for).format('h:mm A')}
            </span>
            {nudge.recurrence && (
              <Badge variant="outline">{nudge.recurrence.replace(/_/g, ' ')}</Badge>
            )}
            <Badge variant={STATUS_BADGE[nudge.status] ?? 'secondary'} className="ml-auto">
              {nudge.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Action buttons — bottom row, visible on hover */}
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isOver && (
          <>
            <Button size="sm" variant="success" className="flex-1 h-7 text-xs gap-1.5" onClick={() => onComplete(nudge.id)}>
              <Check size={12} /> Done
            </Button>
            <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs gap-1.5" onClick={() => onSnooze(nudge.id, 60)}>
              <Clock size={12} /> Snooze
            </Button>
            <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs gap-1.5 hover:bg-destructive/10 hover:text-destructive" onClick={() => onDismiss(nudge.id)}>
              <X size={12} /> Dismiss
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" className={cn('h-7 text-xs gap-1.5 hover:bg-destructive/10 hover:text-destructive', isOver ? 'flex-1' : 'px-2')} onClick={() => onDelete?.(nudge.id)}>
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  )
}
