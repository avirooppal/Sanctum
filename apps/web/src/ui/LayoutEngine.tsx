import React, { type ReactNode } from 'react';
import { PanelErrorBoundary } from './ErrorBoundary.js';
import { type PanelDefinition, type PanelSlot, getPanel } from './PanelRegistry.js';
import { type LayoutSlots } from './Customization.js';

interface LayoutEngineProps {
  slots: LayoutSlots;
  availablePanels: PanelDefinition[];
  panelProps: Record<string, any>;
  sidebarSide?: 'left' | 'right';
}

export function LayoutEngine({
  slots,
  availablePanels,
  panelProps,
  sidebarSide = 'left',
}: LayoutEngineProps) {
  const panelMap = new Map<string, PanelDefinition>();
  for (const p of availablePanels) {
    panelMap.set(p.id, p);
  }

  function renderSlotContent(slot: PanelSlot): ReactNode {
    const panelId = slots[slot];
    if (!panelId || panelId === 'none') return null;

    const panel = panelMap.get(panelId) || getPanel(panelId);
    if (!panel) return null;

    const Component = panel.component;
    const props = panelProps[panelId] || {};

    return (
      <PanelErrorBoundary panelId={panel.id} panelTitle={panel.title}>
        <Component {...props} />
      </PanelErrorBoundary>
    );
  }

  const leftContent = renderSlotContent('left');
  const centerContent = renderSlotContent('center');
  const rightContent = renderSlotContent('right');
  const bottomContent = renderSlotContent('bottom');

  return (
    <div
      className="workspace-slots-container"
      data-sidebar-side={sidebarSide}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        className="workspace-horizontal-slots"
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: sidebarSide === 'right' ? 'row-reverse' : 'row',
          overflow: 'hidden',
        }}
      >
        {leftContent && (
          <aside
            className="workspace-slot workspace-slot-left"
            style={{
              width: 'var(--workspace-slot-left-width, 237px)',
              minWidth: '200px',
              maxWidth: '380px',
              borderRight: sidebarSide === 'left' ? '1px solid var(--ui-border, #283832)' : 'none',
              borderLeft: sidebarSide === 'right' ? '1px solid var(--ui-border, #283832)' : 'none',
              overflowY: 'auto',
              background: 'var(--ui-sidebar, #121815)',
            }}
          >
            {leftContent}
          </aside>
        )}

        <section
          className="workspace-slot workspace-slot-center"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--ui-surface, #151c19)',
          }}
        >
          {centerContent}
        </section>

        {rightContent && (
          <aside
            className="workspace-slot workspace-slot-right"
            style={{
              width: 'var(--workspace-slot-right-width, 320px)',
              minWidth: '260px',
              maxWidth: '480px',
              borderLeft: sidebarSide === 'left' ? '1px solid var(--ui-border, #283832)' : 'none',
              borderRight: sidebarSide === 'right' ? '1px solid var(--ui-border, #283832)' : 'none',
              overflowY: 'auto',
              background: 'var(--ui-surface-raised, #1c2622)',
            }}
          >
            {rightContent}
          </aside>
        )}
      </div>

      {bottomContent && (
        <footer
          className="workspace-slot workspace-slot-bottom"
          style={{
            borderTop: '1px solid var(--ui-border, #283832)',
            maxHeight: '180px',
            overflowY: 'auto',
            background: 'var(--ui-surface-raised, #1c2622)',
          }}
        >
          {bottomContent}
        </footer>
      )}
    </div>
  );
}
