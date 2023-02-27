import ComponentChildren from './ComponentChildren';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import './tooltip.css';

interface Props {
  children: ComponentChildren;
  title?: string;
}
export default function Tooltip(props: Props) {
  const { children } = props;
  let title: ComponentChildren = props.title;
  let trigger: ComponentChildren = children;

  if (title === undefined) {
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && child['type'] === Title) {
          title = child;
        } else if (child && child['type'] === Trigger) {
          trigger = child;
        }
      }
    }
  }

  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root delayDuration={800}>
        <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="TooltipContent"
            sideOffset={5}
            collisionPadding={5}
            align="start"
          >
            {title}
            <TooltipPrimitive.Arrow className="TooltipArrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

const Trigger = ({ children }: { children: ComponentChildren }) => children;

const Title = ({ children }: { children: ComponentChildren }) => children;

Tooltip.Trigger = Trigger;
Tooltip.Title = Title;
