import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { SyncSocket, SyncSocketState } from './SyncSocket';

const SyncSocketContext = createContext<SyncSocket | null>(null);

export function SyncSocketProvider({
  socket,
  children,
}: {
  socket: SyncSocket;
  children: ReactNode;
}) {
  return (
    <SyncSocketContext.Provider value={socket}>
      {children}
    </SyncSocketContext.Provider>
  );
}

export function useSync() {
  const socket = useContext(SyncSocketContext);
  if (!socket) {
    throw new Error('useSync() must be used within a SyncSocketProvider');
  }
  const [state, setState] = useState<SyncSocketState>(socket.state());
  // TODO: Replace with overdue changes to avoid spamming the renderer
  // just when we need it most
  // const [pendingChanges, setPendingChanges] = useState(socket.pendingCount());
  useEffect(() => {
    const removeStateL = socket.addStateListener(setState);
    // const removePendingL = socket.addPendingCountListener(setPendingChanges);
    return () => {
      removeStateL();
      // removePendingL();
    };
  }, [socket]);
  return {
    mapId: socket.mapId,
    status: state.status,
    engine: 'engine' in state ? state.engine : null,
    state,
    socket,
    pendingChanges: 0,
  };
}
