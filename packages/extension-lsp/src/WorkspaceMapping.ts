/// A workspace mapping is used to track changes made to open
/// documents, so that positions returned by a request can be
/// interpreted in terms of the current, potentially changed document.
export class WorkspaceMapping {
  /// @internal
  mappings: Map<string, ChangeDesc> = new Map();
  private startDocs: Map<string, Text> = new Map();

  /// @internal
  constructor(private client: LSPClient) {
    for (let file of client.workspace.files) {
      this.mappings.set(file.uri, ChangeSet.empty(file.doc.length));
      this.startDocs.set(file.uri, file.content);
    }
  }

  /// @internal
  addChanges(uri: string, changes: ChangeDesc) {
    let known = this.mappings.get(uri);
    if (known) this.mappings.set(uri, known.composeDesc(changes));
  }

  getMapping(uri: string): ChangeDesc | undefined {
    let known = this.mappings.get(uri);
    if (!known) return undefined;
    let file = this.client.workspace.getFile(uri),
      view = file?.getView(),
      plugin = view && LSPPlugin.get(view);
    return plugin ? known.composeDesc(plugin.unsyncedChanges) : known;
  }

  mapPos(
    uri: string,
    pos: number,
    assoc = -1,
    mode: MapMode = MapMode.Simple,
  ): number | null {
    const changes: ChangeDesc | undefined = this.getMapping(uri);
    return changes ? changes.mapPos(pos, assoc, mode) : pos;
  }

  mapPosition(
    uri: string,
    pos: lsp.Position,
    assoc = -1,
    mode: MapMode = MapMode.Simple,
  ): number | null {
    let start = this.startDocs.get(uri);
    if (!start) {
      throw new Error("Cannot map from a file that's not in the workspace");
    }
    let off = fromPosition(start, pos);
    let changes = this.getMapping(uri);

    console.log('mapPosition', {
      uri,
      pos,
      assoc,
      mode,
      off,
      changes,
    });

    return changes ? changes.mapPos(off, assoc, mode) : off;
  }

  destroy() {
  }
}
