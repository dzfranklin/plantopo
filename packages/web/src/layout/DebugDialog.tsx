import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DebugDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Debug</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-start gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          {window.Native && (
            <Button onClick={() => window.Native!.reportUnauthorized()}>
              Native.reportUnauthorized()
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
