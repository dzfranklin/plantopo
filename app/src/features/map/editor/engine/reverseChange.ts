import { FeatureChange } from '@/gen/sync_schema';
import { Changeset } from '../api/Changeset';
import { WorkingChangeset } from './WorkingChangeset';

interface IRecordGetter {
  featureRecord(id: string): Readonly<Record<string, unknown>> | undefined;
  layerRecord(id: string): Readonly<Record<string, unknown>> | undefined;
}

export function reverseChange(
  records: IRecordGetter,
  change: Changeset,
): Changeset | null {
  const out = new WorkingChangeset();
  if (change.fset) {
    for (const fwd of Object.values(change.fset)) {
      const rev: Record<string, unknown> = { id: fwd.id };
      const curr = records.featureRecord(fwd.id);
      for (const [k, fwdVal] of Object.entries(fwd)) {
        if (k === 'id') continue;
        if (fwdVal === undefined) continue;
        let currVal = curr?.[k];
        if (currVal === undefined) {
          currVal = null;
        }
        if (k === 'parent' || k === 'idx') {
          if (currVal === null) {
            currVal = fwdVal;
          }
        }
        rev[k] = currVal;
      }
      out.fset.set(fwd.id, rev as any as FeatureChange);
    }
  }
  if (change.lset) {
    for (const fwd of Object.values(change.lset)) {
      const rev: Record<string, unknown> = { id: fwd.id };
      const curr = records.layerRecord(fwd.id);
      for (const [k, fwdVal] of Object.entries(fwd)) {
        if (k === 'id') continue;
        if (fwdVal === undefined) continue;
        let currVal = curr?.[k];
        if (currVal === undefined) {
          currVal = null;
        }
        rev[k] = currVal;
      }
      out.lset.set(fwd.id, rev as any as FeatureChange);
    }
  }
  return out.toChangeset();
}
