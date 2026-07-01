export class N {
  // override getCommandFactories(editor: CoreEditor): Partial<CommandFactories> {
  //   return {
  //     'removeMention': () => (state: EditorState, dispatch?: (tr: Transaction) => void, view?: EditorView): boolean => {
  //       let isMention = false
  //       const { selection } = state
  //       const { empty, anchor } = selection

  //       if (!empty) {
  //         return false
  //       }

  //       state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
  //         if (node.type.name === this.name) {
  //           isMention = true
  //           state.tr.insertText(
  //             this.options.deleteTriggerWithBackspace ? '' : this.options.suggestion.char || '',
  //             pos,
  //             pos + node.nodeSize,
  //           )

  //           return false
  //         }
  //       })

  //       return isMention
  //     }
  //   };
  // }

  // override getKeyboardShortcuts(editor: CoreEditor): Partial<CommandShortcuts> {
  //   return {
  //     Backspace: 'removeMention'
  //   };
  // }
}
