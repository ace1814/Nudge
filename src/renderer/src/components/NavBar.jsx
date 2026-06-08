import { House, Bell, ArrowsClockwise, GearSix, Microphone } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'dashboard', Icon: House,           label: 'Today' },
  { id: 'nudges',    Icon: Bell,            label: 'Nudges' },
  { id: 'habits',    Icon: ArrowsClockwise, label: 'Habits' },
  { id: 'settings',  Icon: GearSix,         label: 'Settings' },
]

export default function NavBar({ current, onChange, onMic }) {
  return (
    <div className="no-drag flex items-center border-t border-border bg-background px-3 py-2 gap-1">
      {tabs.map((tab, i) => (
        <>
          {i === 2 && (
            <button
              key="mic"
              onClick={onMic}
              className="flex-shrink-0 mx-1 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-md hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Microphone size={17} weight="fill" className="text-primary-foreground" />
            </button>
          )}
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-colors',
              current === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.Icon size={17} weight={current === tab.id ? 'fill' : 'regular'} />
            <span className="text-[9px] font-medium tracking-wide uppercase">{tab.label}</span>
          </button>
        </>
      ))}
    </div>
  )
}
