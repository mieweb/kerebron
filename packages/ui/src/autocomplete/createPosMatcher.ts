import {
  AutocompleteMatcher,
  AutocompleteTrigger,
  AutocompletMatch,
} from './types.ts';
import { AutocompleteSource } from '@kerebron/ui/autocomplete';

export function createPosMatcher(): AutocompleteMatcher {
  return function (
    this: AutocompleteSource,
    trigger: AutocompleteTrigger,
  ): AutocompletMatch | undefined {
    return {
      range: {
        from: trigger.pos,
        to: trigger.pos,
      },
      text: '',
    };
  };
}
