/**
 * logicWorker.ts — Sandboxed Web Worker for executing TemplateLogic
 *
 * Runs in a dedicated Worker context:
 *   ✓ No DOM access (Web Worker spec)
 *   ✓ No access to React state, Zustand store, or app variables
 *   ✓ Infinite loops killed by main thread via worker.terminate()
 *   ✓ Worker crash is isolated — the app never crashes
 *
 * Uses the same data:text/javascript;base64 + dynamic import mechanism
 * as evalDangerously() in @accordproject/template-engine — proven
 * to work in browser environments and CSP-compatible.
 */

import { normalizeInitPayload, normalizeTriggerPayload } from '../utils/runtimeAdapter';

interface WorkerMessage {
  action: 'init' | 'trigger';
  jsCode: string;       // compiled ES2020 JavaScript
  contractData: object; // parsed agreement JSON data
  request?: object;     // for trigger only
  state?: object;       // for trigger only
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

interface TemplateLogicInstance {
  init?(data: object): Promise<{ state?: object; events?: object[] } | undefined>;
  trigger(data: object, request: object, state: object): Promise<{
    result: object;
    response?: object;
    state?: object;
    events?: object[];
  }>;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { action, jsCode, contractData, request, state } = event.data;

  try {
    // Encode compiled JS as a Base64 data URI and dynamically import it
    // as an ES module. This is the exact same mechanism as evalDangerously()
    // in @accordproject/template-engine (JavaScriptEvaluator.ts).
    // Using unescape + encodeURIComponent handles non-ASCII characters safely.
    const encoded = btoa(unescape(encodeURIComponent(jsCode)));
    const dataUri = `data:text/javascript;base64,${encoded}`;

    // Dynamic import loads the user's TemplateLogic subclass as an ES module.
    // The /* @vite-ignore */ comment suppresses Vite's import analysis warning.
    const module = await import(/* @vite-ignore */ dataUri) as {
      default?: new () => TemplateLogicInstance;
    };

    const LogicClass = module.default;

    if (typeof LogicClass !== 'function') {
      throw new Error(
        'Your logic file must export a default class extending TemplateLogic.\n\n' +
        'Example:\n' +
        '  class MyLogic extends TemplateLogic<any> {\n' +
        '    async trigger(data, request, state) { ... }\n' +
        '  }\n' +
        '  export default MyLogic;'
      );
    }

    const instance = new LogicClass();

    if (action === 'init') {
      // init() is optional — stateless templates don't define it
      const initResponse = typeof instance.init === 'function'
        ? await instance.init(contractData)
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

      const triggerResponse = await instance.trigger(
        contractData,
        request ?? {},
        state
      );
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
