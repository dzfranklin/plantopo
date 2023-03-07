import * as DialogPrim from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';
import ComponentChildren, { ComponentChild } from './ComponentChildren';
import './dialog.css';

const Dialog = ({ children }: { children: ComponentChildren }) => {
  let trigger: ComponentChild;
  let title: ComponentChild;
  let description: ComponentChild;
  const body: ComponentChild[] = [];

  if (Array.isArray(children)) {
    for (const child of children) {
      if (child?.['type'] === Dialog.Trigger) {
        trigger = child;
      } else if (child?.['type'] === Dialog.Title) {
        title = child;
      } else if (child?.['type'] === Dialog.Description) {
        description = child;
      } else {
        body.push(child);
      }
    }
  }

  return (
    <DialogPrim.Root>
      {trigger}

      <DialogPrim.Portal>
        <DialogPrim.Overlay className="DialogOverlay">
          <DialogPrim.Content className="DialogContent">
            <DialogPrim.Title className="DialogTitle">{title}</DialogPrim.Title>

            <div className="DialogBody">
              <DialogPrim.Description className="DialogDescription">
                {description}
              </DialogPrim.Description>

              {body}
            </div>

            <DialogPrim.Close asChild>
              <button className="DialogCloseButton" aria-label="Close">
                <Cross2Icon />
              </button>
            </DialogPrim.Close>
          </DialogPrim.Content>
        </DialogPrim.Overlay>
      </DialogPrim.Portal>
    </DialogPrim.Root>
  );
};

Dialog.Trigger = ({ children }: { children: ReactNode }) => (
  <DialogPrim.Trigger asChild>{children}</DialogPrim.Trigger>
);

Dialog.Close = ({ children }: { children: ReactNode }) => (
  <DialogPrim.Close asChild>{children}</DialogPrim.Close>
);

Dialog.Title = ({ children }: { children: ComponentChildren }) => (
  <>{children}</>
);

Dialog.Description = ({ children }: { children: ComponentChildren }) => (
  <>{children}</>
);

export default Dialog;
