import { describe, expect, it, vi } from 'vitest';

import { createInProcessNotifier, type StoryEvent } from '../notify.js';

const event: StoryEvent = { type: 'TurnAdded', payload: { id: 't1' } };

describe('createInProcessNotifier', () => {
  it('delivers to every listener on the story', () => {
    const notifier = createInProcessNotifier();
    const a = vi.fn();
    const b = vi.fn();
    notifier.subscribe('s1', a);
    notifier.subscribe('s1', b);

    notifier.publish('s1', event);

    expect(a).toHaveBeenCalledWith(event);
    expect(b).toHaveBeenCalledWith(event);
  });

  it('keeps stories isolated from each other', () => {
    const notifier = createInProcessNotifier();
    const other = vi.fn();
    notifier.subscribe('s2', other);

    notifier.publish('s1', event);

    expect(other).not.toHaveBeenCalled();
  });

  it('a throwing listener does not stop the ones after it', () => {
    const onListenerError = vi.fn();
    const notifier = createInProcessNotifier({ onListenerError });
    const boom = new Error('socket closed');
    const throwing = vi.fn(() => {
      throw boom;
    });
    const after = vi.fn();
    notifier.subscribe('s1', throwing);
    notifier.subscribe('s1', after);

    expect(() => notifier.publish('s1', event)).not.toThrow();

    expect(after).toHaveBeenCalledWith(event);
    expect(onListenerError).toHaveBeenCalledWith(boom, 's1', event);
  });

  it('unsubscribing during a publish does not skip the remaining listeners', () => {
    const notifier = createInProcessNotifier();
    const last = vi.fn();
    const unsubscribeSelf = vi.fn(() => off());
    const off = notifier.subscribe('s1', () => unsubscribeSelf());
    notifier.subscribe('s1', last);

    notifier.publish('s1', event);

    expect(last).toHaveBeenCalledWith(event);
  });

  it('unsubscribe is idempotent — a second call spares a re-subscription', () => {
    const notifier = createInProcessNotifier();
    const listener = vi.fn();
    const off = notifier.subscribe('s1', listener);
    notifier.subscribe('s1', () => {});

    off();
    notifier.subscribe('s1', listener); // same function reference, a new registration
    off(); // the stale unsubscribe must not remove it

    notifier.publish('s1', event);

    expect(listener).toHaveBeenCalledWith(event);
  });

  it('unsubscribe stops delivery', () => {
    const notifier = createInProcessNotifier();
    const listener = vi.fn();
    const off = notifier.subscribe('s1', listener);

    off();
    notifier.publish('s1', event);

    expect(listener).not.toHaveBeenCalled();
  });
});
