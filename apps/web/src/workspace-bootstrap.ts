import type {SanctumClient} from './api.js';

export async function loadWorkspace(
  api:Pick<SanctumClient,'capabilities'|'models'|'preferences'>,
  signal:AbortSignal,
) {
  signal.throwIfAborted();
  const capabilities=await api.capabilities(signal);
  signal.throwIfAborted();
  const models=await api.models(signal);
  signal.throwIfAborted();
  const preferences=await api.preferences(signal);
  signal.throwIfAborted();
  return {capabilities,models,preferences};
}
