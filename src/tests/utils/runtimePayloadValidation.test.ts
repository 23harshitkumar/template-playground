import { describe, it, expect } from 'vitest';
import { validateRuntimePayload } from '../../utils/validators';

const MODEL = `namespace org.example.validation@1.0.0

transaction DemoRequest {
  o String id
}

transaction DemoResponse {
  o String message
}

asset DemoState identified by stateId {
  o String stateId
  o Integer count
}

event DemoEvent {
  o String note
}`;

describe('validateRuntimePayload', () => {
  it('accepts valid runtime payload objects', async () => {
    await expect(
      validateRuntimePayload({
        model: MODEL,
        request: { $class: 'org.example.validation@1.0.0.DemoRequest', id: 'req-1' },
        response: { $class: 'org.example.validation@1.0.0.DemoResponse', message: 'ok' },
        state: { $class: 'org.example.validation@1.0.0.DemoState', stateId: 's-1', $identifier: 's-1', count: 1 },
        events: [{ $class: 'org.example.validation@1.0.0.DemoEvent', note: 'done' }],
      })
    ).resolves.toBeUndefined();
  });

  it('rejects runtime payloads that do not include $class', async () => {
    await expect(
      validateRuntimePayload({
        model: MODEL,
        request: { id: 'req-1' } as unknown as object,
      })
    ).rejects.toThrow(/missing \$class/i);
  });
});