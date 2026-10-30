import type { Selection, Transaction } from 'prosemirror-state';
import { ResolvedPos } from 'prosemirror-model';

import type { CoreEditor, TextRange } from '@kerebron/editor';
import { debounce } from '@kerebron/editor/utilities';
import { getRuntimeUri } from '@kerebron/editor/uri';

import { Ui } from '../Ui.ts';
import { KerebronPopup } from '../popup/types.ts';

import {
  AutocompleteSource,
  AutocompleteTrigger,
  AutocompletMatch,
} from './types.ts';

import { createDefaultMatcher } from './createDefaultMatcher.ts';
import { AutocompletePluginKey } from './AutocompletePlugin.ts';

let idGenerator = 1;

export interface AutocompleteMeta {
  addAutocompleteSource?: {
    autocompleteSource: AutocompleteSource;
  };
  trigger?: AutocompleteTrigger;
  setRequest?: AutocompletMatch & {
    source: AutocompleteSource;
    trigger: AutocompleteTrigger;
  };
  setResponse?: AutocompletMatch & {
    id: number;
  };
  clearRequest?: boolean;
}

export class AutoCompleteState<I = any> {
  autocompleteSources: AutocompleteSource[] = [];
  // manual: boolean = false;

  request?: {
    id: number;
    source: AutocompleteSource;
    trigger: AutocompleteTrigger;
    range: TextRange;
    text: string;
    meta: any;
  };

  popup?: KerebronPopup;

  response?: AutocompletMatch & {
    id: number;
  };

  constructor(private editor: CoreEditor) {
    this.matchSource = debounce(this.matchSource.bind(this), 200);
    console.trace('AAAACCCCCCCCCCCCCCCONB');
  }

  private matchSource(trigger: AutocompleteTrigger): void {
    const sources: AutocompleteSource[] = this.autocompleteSources;
    let matched: AutocompletMatch | undefined = undefined;

    for (const source of sources) {
      if (!source.match) {
        continue;
      }
      if (trigger.mode === 'keyboard') {
        if (trigger.key && !source.triggerKeys?.includes(trigger.key)) {
          continue;
        }
      }
      if (trigger.mode === 'auto' && source.triggerKeys) {
        continue;
      }

      const match = source.match.apply(source, [trigger]);
      if (match) {
        matched = match;

        console.log('qqqqmatched', source, match);

        this.dispatchMeta({
          setRequest: {
            source: source,
            trigger,
            range: match.range,
            text: match.text,
            meta: match.meta,
          },
        });

        // this.handleSource(matched);
        break;
      }
    }

    if (!matched) {
      this.dispatchMeta({ clearRequest: true });
    }
  }

  include(from: number) {
    if (!this.request) {
      return false;
    }

    if (from < this.request.range.from) return false;
    if (from > this.request.range.to) return false;

    return true;
  }

  addSource(source: AutocompleteSource) {
    if (
      !source.match && source.triggerKeys?.length === 1 &&
      source.triggerKeys[0].length === 1
    ) {
      source.match = createDefaultMatcher({ char: source.triggerKeys[0] });
    }
    this.autocompleteSources.push(
      source,
    );
  }

  handleCommands(
    pluginMeta: AutocompleteMeta | undefined,
    transaction: Transaction,
  ) {
    if (!pluginMeta) {
      return false;
    }

    if (pluginMeta?.addAutocompleteSource) {
      this.addSource({
        ...pluginMeta.addAutocompleteSource.autocompleteSource,
      });
      return true;
    }

    if (pluginMeta?.trigger) {
      this.matchSource({
        ...pluginMeta?.trigger,
      });
      return true;
    }

    if (pluginMeta?.setRequest) {
      const id = idGenerator++;

      console.log('this.request======================');
      this.request = {
        id,
        trigger: pluginMeta.setRequest.trigger,
        source: pluginMeta.setRequest.source,
        range: pluginMeta.setRequest.range,
        text: pluginMeta.setRequest.text,
        meta: pluginMeta.setRequest.meta,
      };
      this.response = undefined;

      const request = this.request;

      const go = async () => {
        try {
          const ui: Ui = this.editor.ci.resolve('ui')!;
          const createPopup = () => {
            this.popup?.remove();
            this.popup = undefined;
            const popup = ui.createPopup({
              anchorId: `--autocomplete${id}`,
              layer: 'overlayer',
              group: 'hover',
            });
            this.popup = popup;

            return popup;
          };

          this.popup?.remove();
          this.popup = undefined;

          const match: AutocompletMatch = {
            range: request.range,
            text: request.text,
            meta: request.meta,
          };

          const response = await request.source.processRequest(
            request.trigger,
            match,
            createPopup,
          );
          if (!response) {
            this.dispatchMeta({ clearRequest: true });
            return;
          }

          this.dispatchMeta({
            setResponse: {
              ...response,
              id,
            },
          });
        } catch (err) {
          console.error(err);
          this.dispatchMeta({
            clearRequest: true,
          });
        }
      };
      go();

      return true;
    }

    if (pluginMeta.setResponse) {
      this.response = {
        ...pluginMeta.setResponse,
      };
      return true;
    }

    if (pluginMeta?.clearRequest) {
      this.clearRequest();
      return true;
    }

    return false;
  }

  onKeyDown($pos: ResolvedPos, key: string) {
    this.dispatchMeta({
      trigger: {
        mode: 'keyboard',
        node: $pos.parent,
        pos: $pos.pos,
        textOffset: $pos.textOffset,
        uri: getRuntimeUri($pos.parent),
        key,
      },
    });
  }

  onEdit($pos: ResolvedPos) {
    this.dispatchMeta({
      trigger: {
        mode: 'auto',
        node: $pos.parent,
        pos: $pos.pos,
        textOffset: $pos.textOffset,
        uri: getRuntimeUri($pos.parent),
      },
    });
  }

  dispatchMeta(meta: AutocompleteMeta) {
    const tr = this.editor.state.tr;
    tr.setMeta(AutocompletePluginKey, meta);
    this.editor.dispatchTransaction(tr);
  }

  clearRequest() {
    console.log('CLEAR REQUEST');
    this.popup?.remove();
    this.popup = undefined;
    this.request = undefined;
    this.response = undefined;
  }

  destroy() {
    this.clearRequest();
  }
}
