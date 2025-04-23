import {
  Attrs,
  Mark,
  MarkSpec,
  MarkType,
  Node,
  NodeSpec,
  NodeType,
  type Schema,
} from 'prosemirror-model';
import { next as automerge } from '@automerge/automerge/slim';
import { BlockMarker } from './types.ts';

export interface MappedSchemaSpec {
  nodes: { [key: string]: MappedNodeSpec };
  marks?: { [key: string]: MappedMarkSpec };
}

export type MappedNodeSpec = NodeSpec & {
  automerge?: {
    unknownBlock?: boolean;
    block?: BlockMappingSpec;
    isEmbed?: boolean;
    attrParsers?: {
      fromProsemirror: (
        node: Node,
      ) => { [key: string]: automerge.MaterializeValue };
      fromAutomerge: (block: BlockMarker) => Attrs;
    };
  };
};

export type BlockMappingSpec = string;

export type MappedMarkSpec = MarkSpec & {
  automerge?: {
    markName: string;
    parsers?: {
      fromAutomerge: (value: automerge.MarkValue) => Attrs;
      fromProsemirror: (mark: Mark) => automerge.MarkValue;
    };
  };
};

export type MarkMapping = {
  automergeMarkName: string;
  prosemirrorMark: MarkType;
  parsers: {
    fromAutomerge: (value: automerge.MarkValue) => Attrs;
    fromProsemirror: (mark: Mark) => automerge.MarkValue;
  };
};

export type NodeMapping = {
  blockName: string;
  content: NodeType;
  attrParsers?: {
    fromProsemirror: (
      node: Node,
    ) => { [key: string]: automerge.MaterializeValue };
    fromAutomerge: (block: BlockMarker) => Attrs;
  };
  isEmbed?: boolean;
};

export class SchemaAdapter {
  nodeMappings: NodeMapping[];
  markMappings: MarkMapping[];
  unknownBlock: NodeType;
  unknownLeaf: NodeType;
  unknownMark: MarkType;
  schema: Schema;

  constructor(schema: Schema) {
    const nodeMappings: NodeMapping[] = [];
    const markMappings: MarkMapping[] = [];
    let unknownBlock: NodeType | null = null;

    for (const [nodeName, nodeSpec] of Object.entries(schema.nodes)) {
      const adaptSpec = nodeSpec.spec.automerge;
      if (adaptSpec == null) {
        continue;
      }
      if (adaptSpec.unknownBlock) {
        if (unknownBlock != null) {
          throw new Error('only one node can be marked as unknownBlock');
        }
        unknownBlock = schema.nodes[nodeName];
      }
      if (adaptSpec.block != null) {
        const nodeMapping: NodeMapping = {
          blockName: adaptSpec.block,
          content: schema.nodes[nodeName],
          isEmbed: adaptSpec.isEmbed || false,
        };
        if (adaptSpec.attrParsers != null) {
          nodeMapping.attrParsers = adaptSpec.attrParsers;
        }
        nodeMappings.push(nodeMapping);
      }
    }

    for (const [markName, markSpec] of Object.entries(schema.marks || {})) {
      const adaptSpec = markSpec.spec.automerge;
      if (adaptSpec == null) {
        continue;
      }
      if (adaptSpec.markName != null) {
        let parsers;
        if (adaptSpec.parsers != null) {
          parsers = adaptSpec.parsers;
        } else {
          parsers = {
            fromAutomerge: () => ({}),
            fromProsemirror: () => true,
          };
        }
        markMappings.push({
          automergeMarkName: adaptSpec.markName,
          prosemirrorMark: schema.marks[markName],
          parsers,
        });
      }
    }

    if (unknownBlock == null) {
      throw new Error(
        `no unknown block specified: one node must be marked as the unknownblock
by setting the automerge.unknownBlock property to true`,
      );
    }

    this.unknownMark = schema.marks.unknownMark;
    this.nodeMappings = nodeMappings;
    this.markMappings = markMappings;
    this.unknownLeaf = schema.nodes.unknownLeaf;
    this.unknownBlock = unknownBlock;
    this.schema = schema;
  }
}

function shallowClone(spec: MappedSchemaSpec): MappedSchemaSpec {
  const nodes: { [key: string]: MappedNodeSpec } = {};
  for (const [nodeName, node] of Object.entries(spec.nodes)) {
    const shallowCopy = Object.assign({}, node);
    if (node.attrs != null) {
      shallowCopy.attrs = Object.assign({}, node.attrs);
    }
    nodes[nodeName] = shallowCopy;
  }
  const marks: { [key: string]: MappedMarkSpec } = {};
  if (spec.marks != null) {
    for (const [markName, mark] of Object.entries(spec.marks)) {
      const shallowCopy = Object.assign({}, mark);
      if (mark.attrs != null) {
        shallowCopy.attrs = Object.assign({}, mark.attrs);
      }
      marks[markName] = shallowCopy;
    }
  }
  return { nodes, marks };
}

export function addAmgNodeStateAttrs(
  nodes: { [key: string]: MappedNodeSpec },
): {
  [key: string]: MappedNodeSpec;
} {
  for (const [name, nodeSpec] of Object.entries(nodes)) {
    if (name !== 'text') {
      if (nodeSpec.attrs == null) {
        nodeSpec.attrs = {
          isAmgBlock: { default: false },
          unknownAttrs: { default: null },
        };
      } else {
        nodeSpec.attrs.isAmgBlock = { default: false };
        nodeSpec.attrs.unknownAttrs = { default: null };
      }
    }
    if (nodeSpec.automerge?.unknownBlock) {
      if (nodeSpec.attrs == null) {
        nodeSpec.attrs = {
          unknownParentBlock: { default: null },
          unknownBlock: { default: null },
        };
      } else {
        nodeSpec.attrs.unknownParentBlock = { default: null };
        nodeSpec.attrs.unknownBlock = { default: null };
      }
    }
  }
  return nodes;
}

export function amMarksFromPmMarks(
  adapter: SchemaAdapter,
  marks: readonly Mark[],
): automerge.MarkSet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: { [key: string]: any } = {};
  marks.forEach((mark) => {
    const markMapping = adapter.markMappings.find((m) =>
      m.prosemirrorMark === mark.type
    );
    if (markMapping != null) {
      result[markMapping.automergeMarkName] = markMapping.parsers
        .fromProsemirror(mark);
    } else if (mark.type === adapter.unknownMark) {
      for (const [key, value] of Object.entries(mark.attrs.unknownMarks)) {
        result[key] = value;
      }
    }
  });
  return result;
}

export function pmMarksFromAmMarks(
  adapter: SchemaAdapter,
  amMarks: automerge.MarkSet,
): Mark[] {
  const unknownMarks: { [key: string]: automerge.MaterializeValue } = {};
  let hasUnknownMark = false;
  const pmMarks = [];

  for (const [markName, markValue] of Object.entries(amMarks)) {
    // Filter tombstoned marks (https://github.com/automerge/automerge/issues/715).
    if (markValue == null) continue;
    const mapping = adapter.markMappings.find((m) =>
      m.automergeMarkName === markName
    );
    if (mapping == null) {
      unknownMarks[markName] = markValue;
      hasUnknownMark = true;
    } else {
      pmMarks.push(
        mapping.prosemirrorMark.create(
          mapping.parsers.fromAutomerge(markValue),
        ),
      );
    }
  }

  if (hasUnknownMark) {
    pmMarks.push(adapter.unknownMark.create({ unknownMarks }));
  }

  return pmMarks;
}
