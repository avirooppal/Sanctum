/**
 * Typed Panel Registry and Layout Slot Engine.
 * Implements Section D1 of docs/UI_WORKSPACE.md.
 */

import type { ComponentType } from 'react';

export type PanelSlot = 'left' | 'center' | 'right' | 'bottom';

export interface PanelProps {
  panelId: string;
  isActive: boolean;
  onClose?: () => void;
  [key: string]: unknown;
}

export interface PanelDefinition {
  id: string;
  title: string;
  icon: string;
  allowedSlots: PanelSlot[];
  requiredCapabilities: string[];
  defaultVisibility: boolean;
  minSize?: number;
  maxSize?: number;
  shortcut?: string;
  component: ComponentType<PanelProps>;
}

export class PanelRegistry {
  private panels = new Map<string, PanelDefinition>();

  register(panel: PanelDefinition): void {
    if (this.panels.has(panel.id)) {
      throw new Error(`Panel with id '${panel.id}' already registered`);
    }
    if (panel.allowedSlots.length === 0) {
      throw new Error(`Panel '${panel.id}' must declare at least one allowed slot`);
    }
    this.panels.set(panel.id, panel);
  }

  unregister(id: string): boolean {
    return this.panels.delete(id);
  }

  get(id: string): PanelDefinition | undefined {
    return this.panels.get(id);
  }

  all(): PanelDefinition[] {
    return Array.from(this.panels.values());
  }

  /**
   * Return only panels whose required capabilities are all present in the available list.
   */
  filterByCapabilities(availableCapabilities: string[]): PanelDefinition[] {
    const caps = new Set(availableCapabilities);
    return this.all().filter((panel) =>
      panel.requiredCapabilities.every((req) => caps.has(req))
    );
  }

  /**
   * Return matching panels for a specific layout slot that meet capability requirements.
   */
  getSlotPanels(slot: PanelSlot, availableCapabilities: string[]): PanelDefinition[] {
    return this.filterByCapabilities(availableCapabilities).filter((panel) =>
      panel.allowedSlots.includes(slot)
    );
  }
}
