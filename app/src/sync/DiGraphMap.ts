const Incoming = 1;
const Outgoing = 2;
type Direction = typeof Incoming | typeof Outgoing;
const opposite = (dir: Direction): Direction =>
  dir === Incoming ? Outgoing : Incoming;

type Node = number; // Positive integer

class Neighbor {
  constructor(public node: Node, public dir: Direction) {}
}

/**
 * A graph datastructure using an associative array of its node weights N.
 *
 * # Requires
 *
 * - Nodes must be positive integers.
 *
 * # Implementation
 *
 * This is a based on a subset of `GraphMap` in the rust library `petgraph`.
 *
 * It uses an combined adjacency list and sparse adjacency matrix
 * representation, using O(|V| + |E|) space, and allows testing for edge
 * existence in constant time.
 *
 * GraphMap does not allow parallel edges, but self loops are allowed.
 */
export class DiGraphMap<Edge extends string | number | boolean | null> {
  // Note: `Edge` cannot be `undefined` as we need to distinguish nonexistent

  private _nodes = new NodeMap();
  private _edges = new EdgeMap<Edge>();

  containsNode(n: Node): boolean {
    return this._nodes.containsKey(n);
  }

  nodeCount(): number {
    return this._nodes.len();
  }

  *nodes(): IterableIterator<Node> {
    return this._nodes.keys();
  }

  addNode(n: Node): void {
    this._nodes.insertNew(n, []);
  }

  /** Return `true` if node `n` was removed.
   *
   * Computes in **O(V)** time, due to the removal of edges with other nodes.
   */
  removeNode(n: Node): boolean {
    const links = this._nodes.remove(n);
    if (links === undefined) {
      return false;
    }

    for (const succ of links) {
      let a;
      let b;
      if (succ.dir === Outgoing) {
        a = n;
        b = succ.node;
      } else {
        a = succ.node;
        b = n;
      }

      this._removeSingleEdge(a, b, opposite(succ.dir));
      this._edges.remove(a, b);
    }
    return true;
  }

  edgeCount(): number {
    return this._edges.len();
  }

  /** Return an iterator of nodes with an outgoing edge starting from `a` */
  *edges(a: Node): IterableIterator<[Node, Node, Edge]> {
    for (const b of this.neighbors(a)) {
      const edge = this._edges.get(a, b);
      if (edge === undefined) {
        throw new Error('Unreachable');
      }
      yield [a, b, edge];
    }
  }

  /** Returns an iterator over all outgoing edges from `a` */
  *neighbors(a: Node): IterableIterator<Node> {
    const neighbors = this._nodes.get(a);
    if (neighbors === undefined) return;
    for (const neigbor of neighbors) {
      if (neigbor.dir === Outgoing) {
        yield neigbor.node;
      }
    }
  }

  /** Returns an iterator over all edges of the graph in arbitrary order */
  *allEdges(): IterableIterator<[Node, Node, Edge]> {
    return this._edges.iter();
  }

  /** Returns the weight of the edge `a` -> `b`, or undefined if the edge
   * doesn't exist. */
  edgeWeight(a: Node, b: Node): Edge | undefined {
    return this._edges.get(a, b);
  }

  /** Sets the weight of the edge `a` -> `b` to `weight`.
   *
   * # Throws
   *
   * If the edge doesn't exist
   */
  replaceEdgeWeight(a: Node, b: Node, weight: Edge): void {
    this._edges.replace(a, b, weight);
  }

  containsEdge(a: Node, b: Node): boolean {
    return this._edges.containsKey(a, b);
  }

  /** Adds an edge `a` -> `b` with associated data `weight`.
   *
   * Inserts nodes `a` and/or `b` if not already present.
   *
   * Returns `undefined` if the edge did not previously exist, otherwise the old
   * weight is returned.
   */
  addEdge(a: Node, b: Node, weight: Edge): Edge | undefined {
    const old = this._edges.insertGet(a, b, weight);
    if (old !== undefined) {
      return old;
    } else {
      // insert in the adjacency list if it's a new edge
      this._nodes.pushInsert(a, new Neighbor(b, Outgoing));

      // self loops don't have the Incoming entry
      if (a !== b) {
        this._nodes.pushInsert(b, new Neighbor(a, Incoming));
      }
      return;
    }
  }

  /** Removes edge `a` -> `b` and return the edge weight.
   *
   * Return `undefined` if the edge doesn't exist.
   */
  removeEdge(a: Node, b: Node): Edge | undefined {
    const exist1 = this._removeSingleEdge(a, b, Outgoing);

    let exist2: boolean;
    if (a !== b) {
      exist2 = this._removeSingleEdge(b, a, Incoming);
    } else {
      exist2 = exist1;
    }

    const weight = this._edges.remove(a, b);

    if (!(exist1 === exist2 && exist1 === (weight !== undefined))) {
      throw new Error('Unreachable');
    }

    return weight;
  }

  /** Remove edge relation from a to b
   *
   * Return `true` if it did exist.
   */
  private _removeSingleEdge(a: Node, b: Node, dir: Direction): boolean {
    const sus = this._nodes.get(a);
    if (sus === undefined) {
      return false;
    }
    const index = position(sus, (elt) => elt.node === b && elt.dir === dir);
    if (index !== undefined) {
      swapRemove(sus, index);
      return true;
    } else {
      return false;
    }
  }

  /** Perform a depth-first search.
   *
   * Implemented recursively.
   *
   * # Throws
   *
   * If descends past `maxDepth`
   */
  dfs<Return>(
    starts: IterableIterator<Node>,
    visitor: DfsVisitor<Return>,
    maxDepth = 10_000,
  ): Return | undefined {
    const c = new DfsControlFlowImpl<Return>();
    const log = {
      // time needs to be in an object so it can be mutated by reference
      time: 0,
      discovered: new Set<Node>(),
      finished: new Set<Node>(),
    };

    for (const start of starts) {
      this._visitDfs(start, visitor, c, log, maxDepth);

      if (c.wantsBreak) {
        return c.breakValue;
      } else if (c.wantsPrune) {
        throw new Error('Unreachable');
      }
    }

    return;
  }

  private _visitDfs<R>(
    u: Node,
    visitor: DfsVisitor<R>,
    c: DfsControlFlowImpl<R>,
    log: {
      time: number;
      discovered: Set<Node>;
      finished: Set<Node>;
    },
    maxDepth: number,
  ): void {
    if (log.discovered.has(u)) {
      return;
    }
    if (maxDepth <= 0) throw new Error('Reached maxDepth in dfs');
    log.discovered.add(u);

    visitor.discover?.(u, log.time++, c);
    if (c.wantsBreak) return;
    if (!c.wantsPrune) {
      for (const v of this.neighbors(u)) {
        if (!log.discovered.has(v)) {
          visitor.treeEdge?.(u, v, c);
          if (c.wantsBreak) return;
          if (c.wantsPrune) continue;

          this._visitDfs(v, visitor, c, log, maxDepth - 1);
          if (c.wantsBreak) return;
          if (c.wantsPrune) throw new Error('Unreachable');
        } else if (!log.finished.has(v)) {
          visitor.backEdge?.(u, v, c);
          if (c.wantsBreak) return;
          if (c.wantsPrune) continue;
        } else {
          visitor.crossOrForwardEdge?.(u, v, c);
          if (c.wantsBreak) return;
          if (c.wantsPrune) continue;
        }
      }
    }

    if (log.finished.has(u)) {
      throw new Error('Unreachable');
    }
    log.finished.add(u);

    visitor.finish?.(u, log.time++, c);
    if (c.wantsBreak) return;
    if (c.wantsPrune) {
      throw new Error('Pruning forbidden in DfsVisitor.finish');
    }
  }
}

/** Strictly monotonically increasing positive integer */
export type DfsTime = number;

export interface DfsControlFlow<Return> {
  /** Stop the traversal and return `value` */
  breakWith(value?: Return): void;
  /** Prune the current node from the DFS traversal.
   *
   * No more edges from this node will be reported to the visitor. The
   * `discover` for this node will still be reported. This can be called at any
   * time except in `finish`.
   *
   * # Throws
   *
   * If called in `finish` your call to `dfs` will eventually throw.
   */
  prune(): void;
}

class DfsControlFlowImpl<Return> implements DfsControlFlow<Return> {
  wantsPrune = false;

  wantsBreak = false;
  breakValue: Return | undefined;

  breakWith(value?: Return): void {
    this.wantsBreak = true;
    this.breakValue = value;
  }

  prune(): void {
    this.wantsPrune = true;
  }
}

export interface DfsVisitor<Return> {
  discover?(n: Node, time: DfsTime, c: DfsControlFlow<Return>): void;
  /** An edge of the tree formed by the traversal. */
  treeEdge?(a: Node, b: Node, c: DfsControlFlow<Return>): void;
  /** An edge to an already visited node. */
  backEdge?(a: Node, b: Node, c: DfsControlFlow<Return>): void;
  /** A cross or forward edge.
   *
   * For an edge *(u, v)*, if the discover time of *v* is greater than *u*, then
   * it is a forward edge, else a cross edge.
   */
  crossOrForwardEdge?(a: Node, b: Node, c: DfsControlFlow<Return>): void;
  /** All edges from a node have been reported. */
  finish(n: Node, time: DfsTime, c: DfsControlFlow<Return>): Return | undefined;
}

// This internal API is close to the corresponding Rust APIs, making the
// implementation in DiGraphMap match the corresponding Rust closer

class NodeMap {
  /** n -> adjacency list for n */
  private _data: Map<Node, Array<Neighbor>> = new Map();

  len(): number {
    return this._data.size;
  }

  *keys(): IterableIterator<Node> {
    return this._data.keys();
  }

  containsKey(n: Node): boolean {
    return this._data.has(n);
  }

  pushInsert(n: Node, neighbor: Neighbor): void {
    const neighbors = this._data.get(n);
    if (neighbors === undefined) {
      assertValidN(n);
      this._data.set(n, [neighbor]);
    } else {
      neighbors.push(neighbor);
    }
  }

  /** Set if not already present */
  insertNew(n: Node, neighbors: Array<Neighbor>): void {
    if (!this._data.has(n)) {
      assertValidN(n);
      this._data.set(n, neighbors);
    }
  }

  get(n: Node): Array<Neighbor> | undefined {
    return this._data.get(n);
  }

  remove(n: Node): Array<Neighbor> | undefined {
    const value = this._data.get(n);
    if (value) {
      this._data.delete(n);
      return value;
    }
  }
}

class EdgeMap<E> {
  private _len = 0;
  private _data: Map<Node, Map<Node, E>> = new Map();

  len(): number {
    return this._len;
  }

  *iter(): IterableIterator<[Node, Node, E]> {
    for (const [a, sub] of this._data.entries()) {
      for (const [b, edge] of sub.entries()) {
        yield [a, b, edge];
      }
    }
  }

  get(a: Node, b: Node): E | undefined {
    return this._data.get(a)?.get(b);
  }

  containsKey(a: Node, b: Node): boolean {
    const sub = this._data.get(a);
    return sub !== undefined && sub.has(b);
  }

  insertGet(a: Node, b: Node, weight: E): E | undefined {
    const sub = this._data.get(a);
    if (sub === undefined) {
      this._data.set(a, new Map([[b, weight]]));
      this._len += 1;
    } else {
      const old = sub.get(b);
      if (old === undefined) {
        this._len += 1;
      }
      sub.set(b, weight);
      return old;
    }
  }

  /**
   * # Throws
   *
   * If an edge `a` -> `b` doesn't exist
   */
  replace(a: Node, b: Node, weight: E): void {
    this._data.get(a)!.set(b, weight);
  }

  remove(a: Node, b: Node): E | undefined {
    const subData = this._data.get(a);
    if (subData) {
      const old = subData.get(b);
      if (old) {
        this._len -= 1;
        subData.delete(b);
        if (subData.size === 0) {
          this._data.delete(a);
        }
        return old;
      }
    }
    return;
  }
}

/** Searches for an element, returning its index.
 *
 * Takes a closure that returns true or false. It applies this closure to each
 * element of the array, and if one of them returns true, then position()
 * returns its index. If all of them return false, it returns undefined.
 *
 * position() is short-circuiting; in other words, it will stop processing as
 * soon as it finds a true.
 */
function position<T>(
  arr: Array<T>,
  pred: (item: T) => boolean,
): number | undefined {
  for (let i = 0; i < arr.length; i++) {
    if (pred(arr[i])) {
      return i;
    }
  }
}

/// Remove an element from the array and return it.
///
/// Does not preserve order but is O(1).
function swapRemove<T>(arr: Array<T>, index: number): T {
  const len = arr.length;

  if (index >= len) {
    throw new Error(
      `swapRemove index (is ${index}) should be < len (is ${len})`,
    );
  }

  // Note that if the bounds check passed then there must be a last element
  // (which can be arr[index] itself)

  const value = arr[index];
  arr[index] = arr[len - 1];
  arr.length = len - 1;
  return value;
}

function assertValidN(n: unknown): asserts n is Node {
  const isValid =
    typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0;
  if (!isValid) {
    throw new Error(`Invalid node: ${n}`);
  }
}
