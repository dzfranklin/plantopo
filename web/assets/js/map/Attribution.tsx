import Dialog from './components/Dialog';
import { useAppSelector } from './hooks';
import { selectShouldCreditOS } from './layers/slice';

export default function Attribution({ value }: { value: string[] }) {
  const creditOS = useAppSelector(selectShouldCreditOS);

  return (
    <div className="attribution flex flex-row justify-between items-end gap-[60px] pl-[8px]">
      <div className="h-[32px] pb-[8px] flex flex-row min-w-fit pointer-events-none">
        <img src="/images/mapbox_logo.svg" className="h-full" />

        {creditOS && <img src="/images/os_logo.svg" className="h-full" />}
      </div>

      <Dialog>
        <Dialog.Trigger>
          <button className="px-[5px] py-[2px] truncate text-sm bg-white bg-opacity-50">
            {value.map((item, idx) => (
              <span key={idx}>
                {idx != 0 && <span className="mx-[4px]">|</span>}
                <span dangerouslySetInnerHTML={{ __html: item }} />
              </span>
            ))}
          </button>
        </Dialog.Trigger>

        <Dialog.Title>Attribution</Dialog.Title>

        <ul className="list-disc list-inside">
          {value.map((item, idx) => (
            <li key={idx} className="mb-2 list-disc">
              <span dangerouslySetInnerHTML={{ __html: item }} />
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
