import type { CSSProperties, ReactNode } from 'react'


interface PageShellProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  maxWidth?: CSSProperties['maxWidth']
}


export function PageShell({ title, actions, children, maxWidth }: PageShellProps) {
  return (
    <section className="crm-page-shell" style={maxWidth ? { maxWidth } : undefined}>
      <header className="crm-page-heading">
        <h1>{title}</h1>
        {actions ? <div className="crm-page-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}
