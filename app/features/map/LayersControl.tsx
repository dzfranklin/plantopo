import { BaseStyle, baseStyles } from '@/features/map/style';
import { useState } from 'react';
import { Dialog } from '@/components/dialog';
import { Button } from '@/components/button';
import cls from '@/cls';

const baseStyleList = Object.values(baseStyles).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function LayersControl({
  baseStyle,
  setBaseStyle,
}: {
  baseStyle: BaseStyle;
  setBaseStyle: (_: BaseStyle) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <LayerButton
        preview={'/style-preview/landsat_60x60.png'}
        label="Layers"
        onClick={() => setExpanded(true)}
      />

      <Dialog open={expanded} onClose={() => setExpanded(false)}>
        <div>
          <p className="font-semibold mb-2">Base layer</p>
          <ul className="grid grid-cols-[repeat(auto-fit,63px)] gap-x-1 gap-y-2">
            {baseStyleList.map((entry) => (
              <LayerButton
                key={entry.id}
                preview={entry.preview}
                label={entry.name}
                selected={entry.id === baseStyle.id}
                onClick={() => setBaseStyle(entry)}
              />
            ))}
          </ul>
        </div>

        <Dialog.Actions>
          <Button color="primary" onClick={() => setExpanded(false)}>
            Done
          </Button>
        </Dialog.Actions>
      </Dialog>
    </>
  );
}

function LayerButton({
  preview,
  label,
  selected,
  onClick,
}: {
  preview: string;
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'relative h-[63px] w-[63px] text-xs rounded-lg bg-cover',
        selected === undefined && 'border-white border-[1.5px]',
        selected === true && 'border-blue-600 border-[3px]',
        selected === false && 'border-white border-[3px]',
      )}
      style={{
        backgroundImage: `
            linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0) 30%,
              rgba(0, 0, 0, 0.9) 100%
            ),
            url(${encodeURI(preview)})`,
      }}
    >
      <div className="absolute left-1 right-1 bottom-1 text-gray-100 text-center truncate">
        {label}
      </div>
    </button>
  );
}
