import { createContext } from 'react';
import { SyncClient } from './SyncClient';

const SyncContext = createContext<SyncClient | null>(null);

export default SyncContext;
