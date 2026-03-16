import { Concerto, ModelManager } from "@accordproject/concerto-core";

const runtimeModelManagerCache = new Map<string, Promise<ModelManager>>();

interface RuntimeValidationPayload {
  model: string;
  request?: object;
  response?: object;
  result?: object;
  state?: object;
  events?: object[];
}

function assertRuntimeConcept(name: string, value: object): void {
  if (!value || typeof value !== "object") {
    throw new Error(`Invalid ${name}: expected an object.`);
  }

  const className = (value as { $class?: unknown }).$class;
  if (typeof className !== "string" || className.trim().length === 0) {
    throw new Error(`Invalid ${name}: missing $class. Runtime values must be valid Concerto instances.`);
  }
}

async function getRuntimeModelManager(model: string): Promise<ModelManager> {
  const cached = runtimeModelManagerCache.get(model);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const modelManager = new ModelManager({ strict: true });
    modelManager.addCTOModel(model, undefined, true);
    await modelManager.updateExternalModels();
    return modelManager;
  })();

  runtimeModelManagerCache.set(model, promise);
  return promise;
}

/**
 * Validates template inputs before running expensive rebuild operations.
 * Uses official library validators to ensure zero false positives/negatives.
 * Only validates what can be checked without external dependencies.
 * 
 * @param template - Template markdown string (not validated - would require external models)
 * @param model - CTO model string
 * @param data - JSON data string
 * @throws Error with specific validation message if any input is invalid
 */
export async function validateBeforeRebuild(
  _template: string,
  model: string,
  data: string
): Promise<void> {
  // 1. Validate JSON (fastest check)
  try {
    JSON.parse(data);
  } catch (error) {
    throw new Error(`Invalid JSON data: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 2. Validate CTO model syntax using ModelManager
  // This checks syntax but doesn't load external models (which would require network calls)
  try {
    const modelManager = new ModelManager({ strict: true });
    modelManager.addCTOModel(model, undefined, true);
    // Note: We skip updateExternalModels() to avoid expensive network calls
    // We also skip template validation since it may require external models
  } catch (error) {
    throw new Error(`Invalid CTO model: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Note: Template validation is skipped here because it requires external models
  // to be loaded, which would require network calls. The full rebuild will
  // validate the template after loading external models.
}

/**
 * Validates runtime request/result/state/events against Concerto model declarations.
 * This enforces Project 3's requirement that lifecycle payloads are real runtime model instances.
 */
export async function validateRuntimePayload(payload: RuntimeValidationPayload): Promise<void> {
  const modelManager = await getRuntimeModelManager(payload.model);
  const concerto = new Concerto(modelManager);

  const validateObject = (name: string, value: object) => {
    assertRuntimeConcept(name, value);
    concerto.validate(value);
  };

  if (payload.request) {
    validateObject("request", payload.request);
  }
  const responsePayload = payload.response ?? payload.result;
  if (responsePayload) {
    validateObject("response", responsePayload);
  }
  if (payload.state) {
    validateObject("state", payload.state);
  }
  if (payload.events) {
    payload.events.forEach((eventObj, index) => {
      validateObject(`event[${index}]`, eventObj);
    });
  }
}
