'use client'

import type { HTMLAttributes, SyntheticEvent } from 'react'
import { Resizable, type ResizeCallbackData } from 'react-resizable'

import 'react-resizable/css/styles.css'

interface ResizableHeaderCellProps extends HTMLAttributes<HTMLTableCellElement> {
  width?: number
  onResize?: (event: SyntheticEvent<Element>, data: ResizeCallbackData) => void
}

export function ResizableHeaderCell({
  onResize,
  width,
  ...restProps
}: ResizableHeaderCellProps) {
  if (!width || !onResize) return <th {...restProps} />

  return (
    <Resizable
      width={width}
      height={0}
      handle={(
        <span
          className="react-resizable-handle"
          style={{
            position: 'absolute', right: -5, top: 0, bottom: 0, width: 10,
            cursor: 'col-resize', zIndex: 100, padding: 0, margin: 0,
          }}
          onClick={(event) => event.stopPropagation()}
        />
      )}
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative', overflow: 'visible' }} />
    </Resizable>
  )
}
