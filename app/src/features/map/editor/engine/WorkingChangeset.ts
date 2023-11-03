import { Changeset } from '../api/Changeset';
import {
  FeatureChange,
  LayerChange,
  mergeFeature,
  mergeLayer,
} from '@/gen/sync_schema';

export class WorkingChangeset {
  fdelete = new Set<string>();
  fadd = new Set<string>();
  fset = new Map<string, FeatureChange>();
  lset = new Map<string, LayerChange>();

  isEmpty(): boolean {
    return (
      this.fdelete.size === 0 &&
      this.fadd.size === 0 &&
      this.fset.size === 0 &&
      this.lset.size === 0
    );
  }

  mergeIn(other: Changeset) {
    if (other.fdelete) {
      for (const id of other.fdelete) {
        this.fdelete.add(id);
      }
    }
    if (other.fadd) {
      for (const id of other.fadd) {
        this.fadd.add(id);
      }
    }
    if (other.fset) {
      for (const [id, change] of Object.entries(other.fset)) {
        const prev = this.fset.get(id);
        if (prev) {
          mergeFeature(prev, change);
        } else {
          this.fset.set(id, change);
        }
      }
    }
    if (other.lset) {
      for (const [id, change] of Object.entries(other.lset)) {
        const prev = this.lset.get(id);
        if (prev) {
          mergeLayer(prev, change);
        } else {
          this.lset.set(id, change);
        }
      }
    }
  }

  toChangeset(): Changeset | null {
    if (this.isEmpty()) return null;
    const out: Changeset = {};
    if (this.fdelete.size > 0) {
      out.fdelete = [...this.fdelete];
    }
    if (this.fadd.size > 0) {
      out.fadd = [...this.fadd];
    }
    if (this.fset.size > 0) {
      out.fset = Object.fromEntries(this.fset);
    }
    if (this.lset.size > 0) {
      out.lset = Object.fromEntries(this.lset);
    }
    return out;
  }

  clear() {
    this.fdelete.clear();
    this.fadd.clear();
    this.fset.clear();
    this.lset.clear();
  }
}
