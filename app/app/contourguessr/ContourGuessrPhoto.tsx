import { Timestamp } from '@/components/Timestamp';

export function ContourGuessrPhoto(props: {
  width: number;
  height: number;
  url: string;
  attributionText: string;
  attributionLink: string;
  dateTaken: string;
}) {
  return (
    <div>
      <img width={props.width} height={props.height} src={props.url} alt="" />
      <p className="mt-1 text-sm text-right text-gray-700">
        <a href={props.attributionLink} target="_blank" className="link">
          {props.attributionText}
        </a>{' '}
        <Timestamp iso={props.dateTaken} />
      </p>
    </div>
  );
}
