import { User } from './api/User';

export function UserImage({
  width,
  user,
}: {
  width: number;
  user: User | undefined;
}) {
  if (user) {
    let src;
    if (process.env.NODE_ENV === 'development') {
      // TODO: once we deploy just use prod here
      src = user.imageUrl.replace(
        'https://api.plantopo.com',
        'http://localhost:3001',
      );
    } else {
      src = user.imageUrl;
    }

    return (
      <img
        className="rounded-full"
        width={width + 'px'}
        height={width + 'px'}
        crossOrigin="anonymous"
        src={src}
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
