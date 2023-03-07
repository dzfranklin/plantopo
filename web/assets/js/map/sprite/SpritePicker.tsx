import { useMemo, useState } from 'react';
import classNames from '../../classNames';
import { selectCommonSprites } from '../features/slice';
import { useAppStore } from '../hooks';
import data from './preview.json';
import SpritePreview from './SpritePreview';

interface Props {
  value?: string;
  onChange: OnChange;
}

type OnChange = (value: string) => void;

const SpritePicker = (props: Props) => {
  const store = useAppStore();
  // We don't want these to change while the user is editing this feature
  const [initialValue] = useState(props.value);
  const [common, rest] = useMemo(() => {
    const common = selectCommonSprites(store.getState());
    if (initialValue) {
      const prevIdx = common.findIndex((s) => s === initialValue);
      if (prevIdx >= 0) common.splice(prevIdx, 1);
      common.splice(0, 0, initialValue);
    }

    const rest = Object.keys(data).filter((key) => !common.includes(key));
    rest.sort();

    return [common, rest];
  }, [store, initialValue]);

  return (
    <div>
      <div className="flex flex-row overflow-hidden">
        {common.map((sprite) => (
          <Button
            key={sprite}
            sprite={sprite}
            isSelected={props.value === sprite}
            onChange={props.onChange}
          />
        ))}
        TODO CLEAR BUTTON
      </div>

      <div>
        {rest.map((sprite) => (
          <Button
            key={sprite}
            sprite={sprite}
            isSelected={props.value === sprite}
            onChange={props.onChange}
          />
        ))}
      </div>
    </div>
  );
};

const Button = (props: {
  isSelected: boolean;
  onChange: OnChange;
  sprite: string;
}) => (
  <button
    onClick={() => props.onChange(props.sprite)}
    className={classNames(
      'rounded-full p-[3px]',
      props.isSelected && 'bg-blue-100',
    )}
  >
    <SpritePreview sprite={props.sprite} className="w-[20px] h-[20px]" />
  </button>
);

export default SpritePicker;
