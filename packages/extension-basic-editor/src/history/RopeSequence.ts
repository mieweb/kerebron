// Fork and TS port of https://code.haverbeke.berlin/marijn/rope-sequence/

const GOOD_LEAF_SIZE = 200;

// :: class<T> A rope sequence is a persistent sequence data structure
// that supports appending, prepending, and slicing without doing a
// full copy. It is represented as a mostly-balanced tree.
export abstract class RopeSequence<T> {
  abstract length: number;
  abstract depth: number;
  abstract flatten(): T[];

  abstract leafAppend(other: RopeSequence<T>): RopeSequence<T> | undefined;
  abstract leafPrepend(other: RopeSequence<T>): RopeSequence<T> | undefined;

  // :: (union<[T], RopeSequence<T>>) → RopeSequence<T>
  // Append an array or other rope to this one, returning a new rope.
  append(other: RopeSequence<T> | T[]) {
    if (!other.length) return this;
    other = RopeSequence.from(other);

    return (!this.length && other) ||
      (other.length < GOOD_LEAF_SIZE && this.leafAppend(other)) ||
      (this.length < GOOD_LEAF_SIZE && other.leafPrepend(this)) ||
      this.appendInner(other);
  }

  // :: (union<[T], RopeSequence<T>>) → RopeSequence<T>
  // Prepend an array or other rope to this one, returning a new rope.
  prepend(other: RopeSequence<T> | T[]) {
    if (!other.length) return this;
    return RopeSequence.from(other).append(this);
  }

  appendInner(other: RopeSequence<T>): RopeSequence<T> {
    return new Append(this, other);
  }

  abstract sliceInner(from: number, to: number): RopeSequence<T>;

  // :: (?number, ?number) → RopeSequence<T>
  // Create a rope repesenting a sub-sequence of this rope.
  slice(from = 0, to = this.length): RopeSequence<T> {
    if (from >= to) return emptyRopeSequence();
    return this.sliceInner(Math.max(0, from), Math.min(this.length, to));
  }

  abstract getInner(i: number): T | undefined;

  // :: (number) → T
  // Retrieve the element at the given position from this rope.
  get(i: number): T | undefined {
    if (i < 0 || i >= this.length) return undefined;
    return this.getInner(i);
  }

  abstract forEachInner(
    f: (item: T, i: number) => T | boolean,
    from: number,
    to: number,
    start: number,
  ): boolean;
  abstract forEachInvertedInner(
    f: (item: T, i: number) => T | boolean,
    from: number,
    to: number,
    start: number,
  ): boolean;

  // :: ((element: T, index: number) → ?bool, ?number, ?number)
  // Call the given function for each element between the given
  // indices. This tends to be more efficient than looping over the
  // indices and calling `get`, because it doesn't have to descend the
  // tree for every element.
  forEach(
    f: (item: T, i: number) => T | boolean,
    from = 0,
    to = this.length,
  ): void {
    if (from <= to) {
      this.forEachInner(f, from, to, 0);
    } else {
      this.forEachInvertedInner(f, from, to, 0);
    }
  }

  // :: ((element: T, index: number) → U, ?number, ?number) → [U]
  // Map the given functions over the elements of the rope, producing
  // a flat array.
  map(f: (item: T, i: number) => T, from = 0, to = this.length): T[] {
    let result: T[] = [];
    this.forEach(
      (elt, i) => {
        result.push(f(elt, i));
        return elt;
      },
      from,
      to,
    );
    return result;
  }

  // :: (?union<[T], RopeSequence<T>>) → RopeSequence<T>
  // Create a rope representing the given array, or return the rope
  // itself if a rope was given.
  static from<T>(values: RopeSequence<T> | T[]): RopeSequence<T> {
    if (values instanceof RopeSequence) return values;
    return values && values.length ? new Leaf(values) : emptyRopeSequence();
  }

  // flatten:: () → [T]
  // Return the content of this rope as an array.
}

class Leaf<T> extends RopeSequence<T> {
  values: T[];

  constructor(values: T[]) {
    super();
    this.values = values;
  }

  flatten(): T[] {
    return this.values;
  }

  sliceInner(from: number, to: number): RopeSequence<T> {
    if (from == 0 && to == this.length) return this;
    return new Leaf(this.values.slice(from, to));
  }

  getInner(i: number): T {
    return this.values[i];
  }

  forEachInner(
    f: (item: T, i: number) => T,
    from: number,
    to: number,
    start: number,
  ): boolean {
    for (let i = from; i < to; i++) {
      if (f(this.values[i], start + i) === false) return false;
    }

    return true;
  }

  forEachInvertedInner(
    f: (item: T, i: number) => T,
    from: number,
    to: number,
    start: number,
  ): boolean {
    for (let i = from - 1; i >= to; i--) {
      if (f(this.values[i], start + i) === false) return false;
    }

    return true;
  }

  leafAppend(other: RopeSequence<T>): RopeSequence<T> | undefined {
    if (this.length + other.length <= GOOD_LEAF_SIZE) {
      return new Leaf(this.values.concat(other.flatten()));
    }
  }

  leafPrepend(other: RopeSequence<T>): RopeSequence<T> | undefined {
    if (this.length + other.length <= GOOD_LEAF_SIZE) {
      return new Leaf(other.flatten().concat(this.values));
    }
  }

  get length() {
    return this.values.length;
  }

  get depth() {
    return 0;
  }
}

export function emptyRopeSequence() {
  return new Leaf([]);
}

class Append<T> extends RopeSequence<T> {
  left: RopeSequence<T>;
  right: RopeSequence<T>;
  depth: number;
  length: number;

  constructor(left: RopeSequence<T>, right: RopeSequence<T>) {
    super();
    this.left = left;
    this.right = right;
    this.length = left.length + right.length;
    this.depth = Math.max(left.depth, right.depth) + 1;
  }

  flatten() {
    return this.left.flatten().concat(this.right.flatten());
  }

  getInner(i: number): T | undefined {
    return i < this.left.length
      ? this.left.get(i)
      : this.right.get(i - this.left.length);
  }

  forEachInner(
    f: (item: T, i: number) => T,
    from: number,
    to: number,
    start: number,
  ): boolean {
    let leftLen = this.left.length;
    if (
      from < leftLen &&
      this.left.forEachInner(f, from, Math.min(to, leftLen), start) === false
    ) {
      return false;
    }
    if (
      to > leftLen &&
      this.right.forEachInner(
          f,
          Math.max(from - leftLen, 0),
          Math.min(this.length, to) - leftLen,
          start + leftLen,
        ) === false
    ) {
      return false;
    }

    return true;
  }

  forEachInvertedInner(
    f: (item: T, i: number) => T,
    from: number,
    to: number,
    start: number,
  ): boolean {
    let leftLen = this.left.length;
    if (
      from > leftLen &&
      this.right.forEachInvertedInner(
          f,
          from - leftLen,
          Math.max(to, leftLen) - leftLen,
          start + leftLen,
        ) === false
    ) {
      return false;
    }
    if (
      to < leftLen &&
      this.left.forEachInvertedInner(f, Math.min(from, leftLen), to, start) ===
        false
    ) {
      return false;
    }

    return true;
  }

  sliceInner(from: number, to: number) {
    if (from == 0 && to == this.length) return this;
    let leftLen = this.left.length;
    if (to <= leftLen) return this.left.slice(from, to);
    if (from >= leftLen) return this.right.slice(from - leftLen, to - leftLen);
    return this.left.slice(from, leftLen).append(
      this.right.slice(0, to - leftLen),
    );
  }

  leafAppend(other: RopeSequence<T>) {
    let inner = this.right.leafAppend(other);
    if (inner) return new Append(this.left, inner);
  }

  leafPrepend(other: RopeSequence<T>) {
    let inner = this.left.leafPrepend(other);
    if (inner) return new Append(inner, this.right);
  }

  override appendInner(other: RopeSequence<T>): RopeSequence<T> {
    if (this.left.depth >= Math.max(this.right.depth, other.depth) + 1) {
      return new Append(this.left, new Append(this.right, other));
    }
    return new Append(this, other);
  }
}
