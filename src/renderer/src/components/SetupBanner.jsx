import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SetupBanner({ onGoToSettings }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-primary/10 border-b border-primary/20">
      <Zap size={12} className="text-primary flex-shrink-0" />
      <span className="flex-1 text-xs text-primary/90">Add your OpenAI key to activate Nudge.</span>
      <Button size="sm" variant="ghost" onClick={onGoToSettings} className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10">
        Setup →
      </Button>
    </div>
  )
}
