'use client';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';

export default function JSONView({
  data,
  collapsed,
}: {
  data: unknown;
  collapsed?: boolean;
}) {
  data = JSON.parse(
    JSON.stringify(data, (_k, v) => {
      if (v instanceof Map) {
        return Object.fromEntries(v);
      }
      return v;
    }),
  );
  return (
    <div className="m-4">
      <JsonView src={data} collapsed={collapsed} />
    </div>
  );
}
