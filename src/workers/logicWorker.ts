/**
 * logicWorker.ts — Sandboxed Web Worker for executing user logic.
 *
 * Loads compiled JavaScript from the app, imports it via a Blob URL,
 * instantiates the default-exported logic class, then runs init/trigger.
 */

import { normalizeInitPayload, normalizeTriggerPayload } from '../utils/runtimeAdapter';

interface WorkerMessage {
  action: 'init' | 'trigger';
  logicJs: string;
  contractData: object;
  request?: object;
  state?: object;
}

interface WorkerSuccess {
  type: 'success';
  action: 'init' | 'trigger';
  state: object;
  result?: object;
  response?: object;
  events?: object[];
}

interface WorkerError {
  type: 'error';
  message: string;
}

interface LogicModule {
  default?: new () => {
    init?: (data: object) => Promise<unknown>;
    trigger?: (data: object, request: object, state: object) => Promise<unknown>;
  };
}

async function loadLogicModule(logicJs: string): Promise<LogicModule> {
  const blob = new Blob([logicJs], { type: 'text/javascript' });
  const moduleUrl = URL.createObjectURL(blob);
  try {
    return (await import(/* @vite-ignore */ moduleUrl)) as LogicModule;
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { action, logicJs, contractData, request, state } = event.data;

  try {
    const logicModule = await loadLogicModule(logicJs);
    if (!logicModule.default) {
      throw new Error('Logic module must export a default class.');
    }

    const logicInstance = new logicModule.default();

    if (action === 'init') {
      const initResponse = logicInstance.init
        ? await logicInstance.init(contractData)
        : undefined;
      const normalized = normalizeInitPayload(initResponse, { $identifier: 'contract-state' });

      self.postMessage({
        type: 'success',
        action: 'init',
        state: normalized.state,
        events: normalized.events,
      } satisfies WorkerSuccess);

    } else if (action === 'trigger') {
      if (state === undefined) {
        throw new Error(
          'Contract state is undefined. Call "Init Contract" before sending a request.'
        );
      }

      if (!logicInstance.trigger) {
        throw new Error('Logic class must implement trigger(data, request, state).');
      }

      const triggerResponse = await logicInstance.trigger(contractData, request ?? {}, state);
      const normalized = normalizeTriggerPayload(triggerResponse, state);

      self.postMessage({
        type: 'success',
        action: 'trigger',
        state: normalized.state,
        result: normalized.response,
        response: normalized.response,
        events: normalized.events,
      } satisfies WorkerSuccess);
    }

  } catch (err: unknown) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerError);
  }
};
