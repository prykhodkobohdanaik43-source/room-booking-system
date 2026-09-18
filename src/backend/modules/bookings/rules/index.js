import { CapacityRule } from './CapacityRule.js';
import { HorizonRule } from './HorizonRule.js';
import { RoomAvailabilityRule } from './RoomAvailabilityRule.js';
import { TimeRangeRule } from './TimeRangeRule.js';

export function defaultBookingRules({ horizonDays }) {
  return [new TimeRangeRule(), new HorizonRule(horizonDays), new RoomAvailabilityRule(), new CapacityRule()];
}

export { CapacityRule, HorizonRule, RoomAvailabilityRule, TimeRangeRule };
