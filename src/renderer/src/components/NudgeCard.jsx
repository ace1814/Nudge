import { Check, Clock, X } from 'lucide-react'
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

export default function NudgeCard({ nudge, onComplete, onSnooze, onDismiss }) {
  const isDone = nudge.status === 'done'
  const isMissed = nudge.status === 'missed'
  const isOver = isDone || isMissed

  return (
    <div className={cn(
      'group flex items-start gap-3 p-3 rounded-xl border border-border bg-card transition-all',
      isOver && 'opacity-45'
    )}>
      {/* Dot */}
      <div className="mt-[6px] flex-shrink-0">
        <span className={cn('block w-2 h-2 rounded-full', CATEGORY_COLORS[nudge.category] ?? 'bg-zinc-500')} />
      </div>

      {/* Body */}
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

      {/* Action buttons — visible on hover (or always for active) */}
      {!isOver && (
        <div className="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon-sm" variant="success" onClick={() => onComplete(nudge.id)}>
            <Check size={12} />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => onSnooze(nudge.id, 60)} title="Snooze 1 hour">
            <Clock size={12} />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => onDismiss(nudge.id)} title="Dismiss"
            className="hover:bg-destructive/10 hover:text-destructive">
            <X size={12} />
          </Button>
        </div>
      )}
    </div>
  )
}
