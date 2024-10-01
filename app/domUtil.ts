// Inspired by blissfuljs

type Options = {
  tag?: string;
  className?: string;
  contents?: ChildOptions | ChildOptions[];
  style?: CSSStyleDeclaration;
} & Record<string, unknown>;

type ChildOptions = Options | string;

export function createElement(options: Options) {
  const node = document.createElement(options.tag || 'div');

  if (options.style) {
    for (const key in options.style) {
      const value = options.style[key];
      if (value !== undefined) {
        node.style[key] = value;
      }
    }
  }

  for (const key in options) {
    if (key === 'tag' || key === 'contents' || key === 'style') {
      continue;
    }

    if (key in node) {
      (node as any)[key] = options[key];
    } else {
      node.setAttribute(key, options[key] as any);
    }
  }

  if (options.contents !== undefined) {
    const contents = Array.isArray(options.contents)
      ? options.contents
      : [options.contents];

    for (const childOpts of contents) {
      if (typeof childOpts === 'string') {
        node.innerText = childOpts;
      } else {
        const child = createElement(childOpts);
        node.append(child);
      }
    }
  }

  return node;
}
