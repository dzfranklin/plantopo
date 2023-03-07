import { ReactNode } from 'react';

export type ComponentChild = ReactNode | string | undefined;
type ComponentChildren = ComponentChild | ComponentChild[];

export default ComponentChildren;
