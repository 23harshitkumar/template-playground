export interface NormalizedInitPayload {
  state: object;
  events: object[];
}

export interface NormalizedTriggerPayload {
  state: object;
  response: object;
  events: object[];
}

interface InitLikePayload {
  state?: object;
  events?: object[];
}

interface TriggerLikePayload extends InitLikePayload {
  response?: object;
  result?: object;
}

export function normalizeInitPayload(payload: InitLikePayload | undefined, fallbackState: object): NormalizedInitPayload {
  return {
    state: payload?.state ?? fallbackState,
    events: payload?.events ?? [],
  };
}

export function normalizeTriggerPayload(payload: TriggerLikePayload | undefined, fallbackState: object): NormalizedTriggerPayload {
  return {
    state: payload?.state ?? fallbackState,
    response: payload?.response ?? payload?.result ?? {},
    events: payload?.events ?? [],
  };
}
