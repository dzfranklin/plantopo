import DeleteIcon from '@spectrum-icons/workflow/Delete';
import { DialogTrigger, IconProps } from '@adobe/react-spectrum';
import EditIcon from '@spectrum-icons/workflow/Edit';
import { FeatureEditPopover } from './FeatureEditPopover';
import { useEngine } from '../../engine/useEngine';
import cls from '@/generic/cls';
import React, { forwardRef, useRef } from 'react';
import { usePress } from 'react-aria';

export function EntryActionButtons({ fid }: { fid: string }) {
  return (
    <div className="flex flex-row gap-1">
      <EntryEditButton fid={fid} />
      <EntryDeleteButton fid={fid} />
    </div>
  );
}

export function EntryEditButton({ fid }: { fid: string }) {
  const engine = useEngine();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <DialogTrigger type="popover" targetRef={ref}>
      <EntryButton icon={EditIcon} ref={ref} />
      <FeatureEditPopover key={fid} fid={fid} engine={engine} />
    </DialogTrigger>
  );
}

export function EntryDeleteButton({ fid }: { fid: string }) {
  const engine = useEngine();
  return (
    <EntryButton
      onPress={() => engine.delete(fid)}
      isDisabled={!engine.mayEdit}
      icon={DeleteIcon}
    />
  );
}

const EntryButton = forwardRef<
  HTMLButtonElement,
  {
    onPress?: () => any;
    isDisabled?: boolean;
    icon: React.ElementType<Omit<IconProps, 'children'>>;
  }
>(({ onPress, isDisabled, icon: Icon }, ref) => {
  const { pressProps } = usePress({ onPress, isDisabled });
  return (
    <button
      {...pressProps}
      aria-label="delete"
      className={cls(
        'flex justify-center items-center px-0.5',
        'text-gray-600 hover:text-gray-800',
      )}
      ref={ref}
    >
      <Icon height="1em" width="min-content" />
    </button>
  );
});
EntryButton.displayName = 'EntryButton';
