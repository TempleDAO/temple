import { EventEmitter } from 'eventemitter3';

type PointerEvents = 'pointerdown' | 'pointerup' | 'pointermove';
type KeyEvents = 'keydown' | 'keyup';

export class EventEmitterBase<EventName extends string, Event> {
  private readonly emitter = new EventEmitter();
  private nextListenerKey = 0;
  private listnerGroups: Record<number, Partial<Record<EventName, (e: Event) => void>>> = {};

  addListeners(group: Partial<Record<EventName, (e: Event) => void>>) {
    const key = this.nextListenerKey++;
    this.listnerGroups[key] = { ...group };
    Object.entries(group).forEach(([event, listener]) => {
      this.emitter.on(event, listener as (e: Event) => void);
    });
    return key;
  }

  removeListeners(key: number) {
    const group = this.listnerGroups[key];
    delete this.listnerGroups[key];
    Object.entries(group).forEach(([event, listener]) => {
      this.emitter.removeListener(event, listener as (e: Event) => void);
    });
  }

  emit(event: EventName, e: Event) {
    this.emitter.emit(event, e);
  }
}

export class KeyEventEmitter extends EventEmitterBase<KeyEvents, KeyboardEvent> {}
export class PointerEventEmitter extends EventEmitterBase<PointerEvents, React.PointerEvent<HTMLElement>> {}
export class FoldingEventEmitter extends EventEmitterBase<'unfold' | 'refold', void> {}
export class PuzzleSolvedEventEmitter extends EventEmitterBase<'solved', number> {}
