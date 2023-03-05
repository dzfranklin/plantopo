import { PlusIcon } from '@heroicons/react/20/solid';
import {
  DropdownMenu,
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { DotFilledIcon } from '@radix-ui/react-icons';
import { useAppDispatch } from '../hooks';
import { createGroup, enterLatlngPicker } from '../features/slice';
import './dropdown.css';

export default function AddDropdown() {
  const dispatch = useAppDispatch();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center px-2 py-1 m-1 text-xs font-medium text-white bg-indigo-600 border border-transparent rounded shadow-sm h-min focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400 hover:bg-indigo-700">
        <PlusIcon className="w-[20px] mr-1" />
        <span>New</span>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="DropdownMenuContent"
          sideOffset={5}
        >
          <Item
            label="New point"
            cmd="Ctrl+Alt+P"
            onClick={() => dispatch(enterLatlngPicker({ type: 'point' }))}
          />
          <Item
            label="New route"
            cmd="Ctrl+Alt+R"
            onClick={() => dispatch(enterLatlngPicker({ type: 'point' }))}
          />
          <Item
            label="New folder"
            cmd="Ctrl+Alt+F"
            onClick={() => dispatch(createGroup())}
          />

          <DropdownMenuSeparator className="DropdownMenuSeparator" />

          <DropdownMenuLabel className="DropdownMenuLabel">
            Snap to
          </DropdownMenuLabel>

          <DropdownMenuRadioGroup value={'all'} onValueChange={(_val) => {}}>
            <RadioItem label="Everything" value="all" />
            <RadioItem label="My features" value="user" />
            <RadioItem label="None" value="none" />
          </DropdownMenuRadioGroup>

          <DropdownMenuArrow className="DropdownMenuArrow" />
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

function Item({ label, cmd, onClick }) {
  return (
    <DropdownMenuItem className="DropdownMenuItem" onClick={onClick}>
      {label} <div className="RightSlot">{cmd}</div>
    </DropdownMenuItem>
  );
}

function RadioItem({ label, value }) {
  return (
    <DropdownMenuRadioItem
      className="DropdownMenuRadioItem"
      value={value}
      onSelect={(e) => {
        // Don't close the menu on select
        e.preventDefault();
      }}
    >
      <DropdownMenuItemIndicator className="DropdownMenuItemIndicator">
        <DotFilledIcon />
      </DropdownMenuItemIndicator>
      {label}
    </DropdownMenuRadioItem>
  );
}
