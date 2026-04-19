import { DebugFlagsPanel } from "@/components/DebugFlagsPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setDebugFlag, useDebugFlag } from "@/hooks/debug-flags";

export function DebugDialog() {
  const isOpen = useDebugFlag("openDebugDialog");
  const close = () => setDebugFlag("openDebugDialog", false);
  const onOpenChange = (open: boolean) => {
    if (!open) close();
  };
  const setFlagAndClose = (...args: Parameters<typeof setDebugFlag>) => {
    return () => {
      setDebugFlag(...args);
      close();
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:h-[90vh] sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Debug</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-x-hidden overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            <ActionButton to="/dev">{"/dev"}</ActionButton>
            <ActionButton to="/debug-flags">{"/debug-flags"}</ActionButton>
            <ActionButton onClick={() => window.location.reload()}>
              Reload
            </ActionButton>
            <ActionButton onClick={setFlagAndClose("openQueryDevtools", true)}>
              Queries
            </ActionButton>
            <ActionButton
              onClick={() => {
                setDebugFlag("enableLogViewer", true);
                setDebugFlag("openLogViewer", true);
                close();
              }}>
              Logs
            </ActionButton>
            {window.Native && (
              <>
                <ActionButton
                  onClick={() => window.Native!.reportUnauthorized()}>
                  Native.reportUnauthorized()
                </ActionButton>
                <ActionButton onClick={() => window.Native!.openNativeDebug()}>
                  Native.openNativeDebug()
                </ActionButton>
              </>
            )}
          </div>
          <DebugFlagsPanel collapsible />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionButton(props: {
  children: React.ReactNode;
  onClick?: () => void;
  to?: string;
}) {
  const { to, ...commonProps } = props;

  if (to) {
    return <Button variant="outline" size="sm" to={to} {...commonProps} />;
  }
  return <Button variant="outline" size="sm" {...commonProps} />;
}
