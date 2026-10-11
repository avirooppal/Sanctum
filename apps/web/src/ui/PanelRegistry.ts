import React from 'react';

export type PanelSlot = 'left' | 'center' | 'right' | 'bottom';

export interface PanelDefinition {
  id: string;
  title: string;
  icon: string;
  allowedSlots: PanelSlot[];
  requiredCapabilities: string[];
  defaultVisibility: boolean;
  defaultSlot: PanelSlot;
  minSize?: { width?: number; height?: number };
  maxSize?: { width?: number; height?: number };
  shortcut?: string;
  component: React.ComponentType<any>;
}

const registry = new Map<string, PanelDefinition>();

export function registerPanel(definition: PanelDefinition): void {
  if (!definition.id || typeof definition.id !== 'string') {
    throw new Error('Panel id is required');
  }
  if (!definition.allowedSlots || definition.allowedSlots.length === 0) {
    throw new Error(`Panel ${definition.id} must declare at least one allowed slot`);
  }
  if (!definition.component) {
    throw new Error(`Panel ${definition.id} must provide a component`);
  }
  registry.set(definition.id, Object.freeze({ ...definition }));
}

export function unregisterPanel(id: string): boolean {
  return registry.delete(id);
}

export function getPanel(id: string): PanelDefinition | undefined {
  return registry.get(id);
}

export function getRegisteredPanels(): PanelDefinition[] {
  return Array.from(registry.values());
}

export function filterPanelsByCapabilities(
  availableCapabilities: string[],
  panels: PanelDefinition[] = getRegisteredPanels()
): PanelDefinition[] {
  const capSet = new Set(availableCapabilities);
  return panels.filter(panel =>
    panel.requiredCapabilities.every(req => capSet.has(req))
  );
}

export function clearRegistry(): void {
  registry.clear();
}
