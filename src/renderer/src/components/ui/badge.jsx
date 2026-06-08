import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary',
        secondary: 'bg-secondary text-muted-foreground',
        done: 'bg-done/15 text-done',
        missed: 'bg-missed/15 text-missed',
        snoozed: 'bg-snoozed/15 text-snoozed',
        pending: 'bg-pending/15 text-pending',
        outline: 'border border-border text-muted-foreground'
      }
    },
    defaultVariants: { variant: 'secondary' }
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
