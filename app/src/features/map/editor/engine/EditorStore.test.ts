import { EditorStore } from './EditorStore';

let subject: EditorStore;
beforeEach(() => {
  subject = new EditorStore({
    clientId: 'c0',
    mayEdit: true,
    onChange: () => {},
  });
});

it('createFeature works', () => {
  expect(subject.ftree.childOrder()).toHaveLength(0);
  subject.createFeature({
    parent: '',
    idx: 'O',
  });
  expect(subject.ftree.childOrder()).toHaveLength(1);
});

it('create dup', () => {
  expect(subject.ftree.childOrder()).toHaveLength(0);
  const change = {
    fadd: ['f1'],
    fset: {
      f1: {
        id: 'f1',
        parent: '',
        idx: 'O',
      },
    },
  };
  subject.change(change);
  expect(subject.ftree.childOrder()).toHaveLength(1);
  subject.change(change);
  expect(subject.ftree.childOrder()).toHaveLength(1);
});
