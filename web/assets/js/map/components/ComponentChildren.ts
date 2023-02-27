import { ReactNode } from 'react';

type Child = ReactNode | string | undefined;
type ComponentChildren = Child | Child[];

export default ComponentChildren;
