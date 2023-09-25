import { User } from './api/User';

export function UserImage({
  width,
  user,
}: {
  width: number;
  user: User | undefined;
}) {
  if (user) {
    return (
      <img
        className="rounded-full"
        width={width + 'px'}
        height={width + 'px'}
        crossOrigin="anonymous"
        src={user.imageUrl}
        alt=""
      />
    );
  } else {
    return (
      <div
        className="bg-gray-200 rounded-full"
        style={{ width: width + 'px', height: width + 'px' }}
      />
    );
  }
}
