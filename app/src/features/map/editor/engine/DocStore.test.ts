import { FeatureChange } from '@/gen/sync_schema';
import { DocStore } from './DocStore';

let subject: DocStore;
beforeEach(() => {
  subject = new DocStore();
});

const sampleChangeset = () => ({
  fadd: ['f1'],
  fset: {
    f1: {
      id: 'f1',
      parent: '',
      idx: 'O',
    },
  },
  fdelete: ['f-nonexistent1'],
  lset: {
    l1: {
      id: 'l1',
      idx: 'O',
    },
  },
});

test('excludes self-cycles', () => {
  subject.localUpdate(1, {
    fadd: ['f1'],
    fset: {
      f1: {
        id: 'f1',
        parent: '',
      },
    },
  });
  subject.remoteUpdate(2, {
    fset: {
      f1: {
        id: 'f1',
        parent: 'f1',
      },
    },
  });
  expect(subject.toState().features.children).toEqual([]);
});

test('excludes cycles', () => {
  // f1 <- f3 <- f2 <- f1
  subject.localUpdate(1, {
    fadd: ['f1', 'f2', 'f3'],
    fset: {
      f1: {
        id: 'f1',
        parent: 'f2',
        idx: 'O',
      },
      f2: {
        id: 'f2',
        parent: 'f3',
        idx: 'O',
      },
      f3: {
        id: 'f3',
        parent: 'f1',
        idx: 'O',
      },
    },
  });
  expect(subject.toState().features.children).toEqual([]);
});

test('omits features with nonexistent parents', () => {
  subject.remoteUpdate(1, {
    fadd: ['f1'],
    fset: {
      f1: {
        id: 'f1',
        parent: 'f-nonexistent',
        idx: 'O',
      },
    },
  });
  expect(subject.toState().features.children).toEqual([]);
});

test('omits feature collisions', () => {
  subject.localUpdate(1, {
    fadd: ['f1'],
    fset: {
      f1: {
        id: 'f1',
        parent: '',
        idx: 'O',
      },
    },
  });
  subject.remoteUpdate(2, {
    fadd: ['f2'],
    fset: {
      f2: {
        id: 'f2',
        parent: '',
        idx: 'O',
      },
    },
  });
  expectFeatureChildren('', [
    {
      id: 'f1',
      parent: '',
      idx: 'O',
    },
  ]);
});

test('omits layer collisions', () => {
  subject.localUpdate(1, {
    lset: {
      l1: {
        id: 'l1',
        idx: 'O',
      },
    },
  });
  subject.remoteUpdate(2, {
    lset: {
      l2: {
        id: 'l2',
        idx: 'O',
      },
    },
  });
  expectLayerOrder([
    {
      value: { id: 'l1', idx: 'O' },
    },
  ]);
});

test('omits layer with misisng idx from order but includes in byLayer', () => {
  subject.localUpdate(1, {
    lset: {
      l1: {
        id: 'l1',
      },
    },
  });
  const state = subject.toState();
  expect(state.layerOrder).toEqual([]);
  expect(state.byLayer.size).toEqual(1);
});

test('omits feature with missing idx', () => {
  subject.localUpdate(1, {
    fadd: ['f1'],
    fset: {
      f1: {
        id: 'f1',
        parent: '',
      },
    },
  });
  const state = subject.toState();
  expect(state.features.children).toEqual([]);
  expect(state.byFeature.size).toEqual(0);
});

test('omits feature with missing parent', () => {
  subject.localUpdate(1, {
    fadd: ['f1'],
    fset: {
      f1: {
        id: 'f1',
        idx: 'O',
      },
    },
  });
  const state = subject.toState();
  expect(state.features.children).toEqual([]);
  expect(state.byFeature.size).toEqual(0);
});

test('remoteUpdate', () => {
  subject.remoteUpdate(1, sampleChangeset());

  expectLayerOrder([
    {
      value: { id: 'l1', idx: 'O' },
    },
  ]);
  expectFeatureChildren('', [
    {
      id: 'f1',
      parent: '',
      idx: 'O',
    },
  ]);
});

test('localUpdate', () => {
  subject.localUpdate(1, sampleChangeset());

  expectLayerOrder([
    {
      value: { id: 'l1', idx: 'O' },
    },
  ]);
  expectFeatureChildren('', [
    {
      id: 'f1',
      parent: '',
      idx: 'O',
    },
  ]);
});

test('localUpdate preserves fadd order', () => {
  subject.localUpdate(1, {
    fadd: ['f1', 'f2'],
    fset: {
      f1: { id: 'f1', parent: '', idx: 'O' },
      f2: { id: 'f2', parent: '', idx: 'P' },
    },
  });
  subject.localUpdate(2, {
    fadd: ['f3'],
    fset: { f3: { id: 'f3', parent: '', idx: 'Q' } },
  });
  expect(subject.localChangesAfter(0)?.fadd).toEqual(['f1', 'f2', 'f3']);
});

test('local changes removed on ack', () => {
  subject.remoteUpdate(1, {
    fadd: ['f1'],
    fset: {
      f1: {
        id: 'f1',
        parent: '',
        idx: 'O',
      },
    },
  });

  subject.localUpdate(1, {
    fadd: ['f2'],
    fset: {
      f1: {
        id: 'f1',
        parent: '',
        idx: 'A',
      },
      f2: {
        id: 'f2',
        parent: '',
        idx: 'Z',
      },
    },
  });

  expectFeatureChildren('', [
    { id: 'f1', parent: '', idx: 'A' },
    { id: 'f2', parent: '', idx: 'Z' },
  ]);

  subject.remoteAck(1);

  expectFeatureChildren('', [{ id: 'f1', parent: '', idx: 'O' }]);
});

test('localChangesAfter excludes remote changes', () => {
  subject.remoteUpdate(1, sampleChangeset());
  expect(subject.localChangesAfter(0)).toEqual(null);
});

test('localChangesAfter excludes changes before', () => {
  subject.localUpdate(1, sampleChangeset());
  expect(subject.localChangesAfter(2)).toEqual(null);
});

test('localChangesAfter includes changes after', () => {
  const change = sampleChangeset();
  subject.localUpdate(10, change);

  const got = subject.localChangesAfter(9);
  expect(got).toEqual(change);
});

test('localChangesAfter merges', () => {
  subject.localUpdate(10, sampleChangeset());
  subject.localUpdate(11, {
    fadd: ['f2'],
    fset: {
      f1: {
        id: 'f1',
        idx: 'A',
        name: 'foo',
      },
      f2: {
        id: 'f2',
        parent: '',
        idx: 'Z',
      },
    },
    fdelete: ['f-nonexistent2'],
    lset: {
      l1: {
        id: 'l1',
        idx: 'Z',
        opacity: 0.5,
      },
    },
  });

  const got = subject.localChangesAfter(9);
  expect(got).toEqual({
    fadd: ['f1', 'f2'],
    fset: {
      f1: {
        id: 'f1',
        parent: '',
        idx: 'A',
        name: 'foo',
      },
      f2: {
        id: 'f2',
        parent: '',
        idx: 'Z',
      },
    },
    fdelete: ['f-nonexistent1', 'f-nonexistent2'],
    lset: {
      l1: {
        id: 'l1',
        idx: 'Z',
        opacity: 0.5,
      },
    },
  });
});

function expectLayerOrder(expected: any) {
  expect(subject.toState().layerOrder).toEqual(expected);
}

function expectFeatureChildren(parent: string, expected: Array<FeatureChange>) {
  const state = subject.toState();
  let got: Array<FeatureChange>;
  if (parent === '') {
    got = state.features.children.map((child) => child.value);
  } else {
    const gotParent = state.byFeature.get(parent);
    if (!gotParent) {
      throw new Error(`expectFeatureChildren: parent ${parent} not found`);
    }
    got = gotParent.children.map((child) => child.value);
  }
  expect(got).toEqual(expected);
}
