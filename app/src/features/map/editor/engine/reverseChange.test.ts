import { Changeset } from '../api/Changeset';
import { DocStore } from './DocStore';
import { reverseChange } from './reverseChange';

describe('reverseChange', () => {
  const cases: Record<
    string,
    { doc: Changeset; change: Changeset; expect: Changeset | null }
  > = {
    empty: {
      doc: {},
      change: {},
      expect: null,
    },
    fadd: {
      doc: {},
      change: {
        fadd: ['f1'],
        fset: {
          f1: {
            id: 'f1',
            parent: '',
            idx: 'O',
            name: 'name',
          },
        },
      },
      // if we deleted the feature we couldn't redo. instead we just nullify all
      // non-required fields
      expect: {
        fset: {
          f1: {
            id: 'f1',
            parent: '',
            idx: 'O',
            name: null,
          },
        },
      },
    },
    'fset add field': {
      doc: {
        fadd: ['f1'],
        fset: {
          f1: { id: 'f1' },
        },
      },
      change: {
        fset: {
          f1: {
            id: 'f1',
            name: 'new name',
          },
        },
      },
      expect: {
        fset: {
          f1: {
            id: 'f1',
            name: null,
          },
        },
      },
    },
    'fset change field': {
      doc: {
        fadd: ['f1'],
        fset: {
          f1: {
            id: 'f1',
            name: 'old name',
          },
        },
      },
      change: {
        fset: {
          f1: {
            id: 'f1',
            name: 'new name',
          },
        },
      },
      expect: {
        fset: {
          f1: {
            id: 'f1',
            name: 'old name',
          },
        },
      },
    },
    'fset unset field': {
      doc: {
        fadd: ['f1'],
        fset: {
          f1: {
            id: 'f1',
            name: 'old name',
          },
        },
      },
      change: {
        fset: {
          f1: {
            id: 'f1',
            name: null,
          },
        },
      },
      expect: {
        fset: {
          f1: {
            id: 'f1',
            name: 'old name',
          },
        },
      },
    },
    'fset set field to undefined': {
      doc: {
        fadd: ['f1'],
        fset: {
          f1: {
            id: 'f1',
            name: 'old name',
          },
        },
      },
      change: {
        fset: {
          f1: {
            id: 'f1',
            name: undefined,
          },
        },
      },
      // setting to undefined does nothing, so reversing also does nothing
      expect: {
        fset: {
          f1: {
            id: 'f1',
          },
        },
      },
    },
    'change with only fdelete': {
      doc: {
        fadd: ['f1'],
        fset: {
          f1: {
            id: 'f1',
          },
        },
      },
      change: {
        fdelete: ['f1'],
      },
      // cannot be reversed
      expect: null,
    },
    'change with fdelete and others': {
      doc: {
        fadd: ['f1'],
        fset: {
          f1: { id: 'f1', name: 'Feature 1' },
        },
      },
      change: {
        fadd: ['f2'],
        fdelete: ['f1'],
        fset: {
          f2: { id: 'f2', name: 'Feature 2' },
        },
      },
      expect: {
        fset: {
          f2: { id: 'f2', name: null },
        },
      },
    },
    'lset add field': {
      doc: {},
      change: {
        lset: {
          l1: { id: 'l1', opacity: 0.5 },
        },
      },
      expect: {
        lset: {
          l1: { id: 'l1', opacity: null },
        },
      },
    },
    'lset change field': {
      doc: {
        lset: {
          l1: { id: 'l1', opacity: 0.5 },
        },
      },
      change: {
        lset: {
          l1: { id: 'l1', opacity: 0.8 },
        },
      },
      expect: {
        lset: {
          l1: { id: 'l1', opacity: 0.5 },
        },
      },
    },
    'lset unset field': {
      doc: {
        lset: {
          l1: { id: 'l1', opacity: 0.5 },
        },
      },
      change: {
        lset: {
          l1: { id: 'l1', opacity: null },
        },
      },
      expect: {
        lset: {
          l1: { id: 'l1', opacity: 0.5 },
        },
      },
    },
    'lset set field to undefined': {
      doc: {
        lset: {
          l1: { id: 'l1', opacity: 0.5 },
        },
      },
      change: {
        lset: {
          l1: { id: 'l1', opacity: undefined },
        },
      },
      // setting to undefined does nothing, so reversing also does nothing
      expect: {
        lset: {
          l1: { id: 'l1' },
        },
      },
    },
  };
  for (const [name, entry] of Object.entries(cases)) {
    test(name, () => {
      const doc = new DocStore();
      doc.localUpdate(1, entry.doc);
      const actual = reverseChange(doc, entry.change);
      expect(actual).toEqual(entry.expect);
    });
  }
});
