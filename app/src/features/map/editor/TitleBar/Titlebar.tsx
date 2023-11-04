import { MapIcon } from '@/generic/MapIcon';
import { TitlebarMenu } from './TitlebarMenu';
import cls from '@/generic/cls';
import { TitleEditComponent } from './TitleEditComponent';
import { StatusComponent } from './StatusComponent';

export function Titlebar() {
  return (
    <div
      className={cls(
        'grid grid-cols-[min-content_1fr] grid-rows-[min-content_min-content]',
        'pl-3 pr-1 py-1 items-center border-b border-neutral-300 bg-neutral-100',
      )}
    >
      <div className="col-start-1 pr-2 row-span-full">
        {/* Ordinary navigation avoids bugs around pages router -> app router  */}
        <a href="/dashboard" className="text-blue-700">
          <MapIcon />
        </a>
      </div>

      <div className="flex justify-between col-start-2 row-start-1 gap-2 mx-1">
        <TitleEditComponent />
        <StatusComponent />
      </div>

      <div className="flex items-center col-start-2 row-start-2 gap-2 grow">
        <TitlebarMenu />
      </div>
    </div>
  );
}
