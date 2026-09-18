import { ConflictError } from '../../shared/errors.js';

// ФВ-18
export class SlotTakenError extends ConflictError {
  constructor() {
    super('Слот уже зайнято', 'SLOT_TAKEN');
  }
}
