/**
 * logicWorker.ts — Sandboxed Web Worker for executing TemplateLogic
 *
 * Runs in a dedicated Worker context:
 *   ✓ No DOM access (Web Worker spec)
 *   ✓ No access to React state, Zustand store, or app variables
 *   ✓ Infinite loops killed by main thread via worker.terminate()
 *   ✓ Worker crash is isolated — the app never crashes
 *
 * Execution uses the official @accordproject/template-engine runtime
 * (TemplateArchiveProcessor.init/trigger) as the single source of truth.
 */

import { ModelManager } from '@accordproject/concerto-core';
import { Buffer } from 'buffer';
import {
  TemplateArchiveProcessor,
  getTemplateClassDeclaration,
} from '@accordproject/template-engine';
import { normalizeInitPayload, normalizeTriggerPayload } from '../utils/runtimeAdapter';

if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

interface WorkerMessage {
  action: 'init' | 'trigger';
  modelCto: string;
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

interface TemplateClassLike {
  getFullyQualifiedName(): string;
}

const DEFAULT_LOGIC_IDENTIFIER = 'logic/logic.js';

async function createRuntimeProcessor(
  modelCto: string,
  logicJs: string,
  contractData: object,
): Promise<TemplateArchiveProcessor> {
  const modelManager = new ModelManager({ strict: true });
  modelManager.addCTOModel(modelCto, undefined, true);

  const templateConceptFqn =
    (contractData as { $class?: unknown }).$class &&
    typeof (contractData as { $class?: unknown }).$class === 'string'
      ? (contractData as { $class: string }).$class
      : undefined;

  const templateClass = getTemplateClassDeclaration(
    modelManager,
    templateConceptFqn,
  ) as TemplateClassLike;

  const scriptFile = {
    getIdentifier: () => DEFAULT_LOGIC_IDENTIFIER,
    getContents: () => logicJs,
  };

  const scriptManager = {
    getScriptsForTarget: (language: string) =>
      language === 'es6' ? [scriptFile] : [],
  };

  const logicManager = {
    getLanguage: () => 'es6',
    getScriptManager: () => scriptManager,
  };

  const templateFacade = {
    getLogicManager: () => logicManager,
    getModelManager: () => modelManager,
    getTemplateModel: () => templateClass,
  };

  return new TemplateArchiveProcessor(templateFacade as never);
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { action, modelCto, logicJs, contractData, request, state } = event.data;

  try {
    const processor = await createRuntimeProcessor(modelCto, logicJs, contractData);

    if (action === 'init') {
      const initResponse = await processor.init(contractData);
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

      const triggerResponse = await processor.trigger(
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
